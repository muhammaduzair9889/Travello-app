"""
Layer 2: Learning-to-Rank Model Service

ML-based ranking of places for itinerary recommendations.
Uses LightGBM model trained on user preferences + place features.
Enhanced with HuggingFace semantic embeddings for personalization.
"""

import logging
import pickle
import os
import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Try importing LightGBM, fallback if not available
try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    logger.warning("LightGBM not available. Using rule-based fallback.")
    lgb = None

# Delay HuggingFace ranker import to runtime to keep management commands fast.
create_hf_ranker = None


@dataclass
class RankingFeatures:
    """Feature vector for place ranking"""
    # User features
    mood_id: int  # 0-8 for each mood
    budget_level: int  # 0-3
    interest_tags: List[float]  # one-hot or embedding
    
    # Place features
    category_id: int  # 0-N categories
    place_tags: List[float]  # one-hot or embedding
    rating: float  # 1-5
    popularity_score: float  # 0-100
    price_level: int  # 1-4
    distance_from_hotel: float  # km
    
    # Contextual features
    day_index: int  # 0-N days
    time_of_day: int  # 0=morning, 1=afternoon, 2=evening
    hours_available: float  # remaining hours in day
    previously_visited_count: int  # how many days ago used this place
    
    # Place attributes
    is_outdoor: bool
    is_cultural: bool
    opening_hours_match: float  # 0-1, how well opening hours match time of day
    
    def to_array(self) -> np.ndarray:
        """Convert to flat numpy array for model"""
        features = [
            self.mood_id,
            self.budget_level,
            self.rating,
            self.popularity_score,
            self.price_level,
            self.distance_from_hotel,
            self.day_index,
            self.time_of_day,
            self.hours_available,
            self.previously_visited_count,
            float(self.is_outdoor),
            float(self.is_cultural),
            self.opening_hours_match,
            self.category_id,
        ]
        # Add any one-hot features
        features.extend(self.interest_tags)
        features.extend(self.place_tags)
        return np.array(features, dtype=np.float32)


@dataclass  
class RankedPlace:
    """Place with ranking score"""
    place_id: str
    place_name: str
    score: float  # ML model score 0-1
    confidence: float  # Model confidence 0-1
    is_ml_ranked: bool  # True if ML model, False if fallback


class LearningToRankService:
    """
    Ranks places using gradient boosted trees (LightGBM).
    Provides fallback to rule-based scoring if model unavailable.
    """
    
    MOOD_TO_ID = {
        'RELAXING': 0, 'SPIRITUAL': 1, 'HISTORICAL': 2, 'FOODIE': 3,
        'FUN': 4, 'SHOPPING': 5, 'NATURE': 6, 'ROMANTIC': 7, 'FAMILY': 8
    }
    
    BUDGET_TO_ID = {'LOW': 0, 'MEDIUM': 1, 'LUXURY': 2}
    
    CATEGORY_TO_ID = {
        'religious': 0, 'history': 1, 'culture': 2, 'food': 3,
        'nature': 4, 'shopping': 5, 'modern': 6, 'other': 7
    }
    
    PACE_TO_ID = {'RELAXED': 0, 'BALANCED': 1, 'PACKED': 2}
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize ranking service.
        
        Args:
            model_path: Path to saved LightGBM model package. If None, use rule-based fallback.
        """
        self.model = None
        self.scaler = None
        self.feature_columns = None
        self.categorical_mappings = None
        self.model_version = None
        self.last_confidence = 0.0
        self.inference_latency_ms = 0
        
        # Initialize HuggingFace ranker for semantic scoring.
        # Import here to avoid loading transformers during unrelated management commands.
        self.hf_ranker = None
        try:
            from itineraries.hf_ranker import create_hf_ranker as _create_hf_ranker
            self.hf_ranker = _create_hf_ranker()
            if self.hf_ranker is not None:
                logger.info("HuggingFace ranker initialized for semantic scoring")
            else:
                logger.warning("HuggingFace ranker unavailable at runtime. Proceeding with LightGBM + fallback scoring.")
        except Exception as e:
            logger.warning(f"Failed to initialize HF ranker: {e}")
        
        if model_path and LIGHTGBM_AVAILABLE:
            self._load_model_package(model_path)
        else:
            logger.info("ML ranking model not loaded. Using rule-based fallback.")
    
    def _load_model_package(self, model_path: str):
        """Load pre-trained LightGBM model package with scaler and metadata"""
        try:
            if not os.path.exists(model_path):
                logger.warning(f"Model file not found at {model_path}")
                return
            
            with open(model_path, 'rb') as f:
                package = pickle.load(f)
            
            self.model = package.get('model')
            self.scaler = package.get('scaler')
            self.feature_columns = package.get('feature_columns')
            self.categorical_mappings = package.get('categorical_mappings')
            
            logger.info(f"Loaded LightGBM model package from {model_path}")
            logger.info(f"  Features: {len(self.feature_columns) if self.feature_columns else 0}")
            logger.info(f"  Trained: {package.get('trained_at', 'unknown')}")
            
        except Exception as e:
            logger.error(f"Failed to load model package: {e}")
            self.model = None
            self.scaler = None
    
    def _get_place_attr(self, place, attr: str, default=None):
        """
        Get attribute from place (handles both dict and model instances).
        Works with:
        - Django Place model instances
        - Plain dict objects
        """
        # Try dict access first
        if hasattr(place, 'get'):
            return place.get(attr, default)
        # Fall back to model attribute access
        return getattr(place, attr, default)
    
    def rank_places(
        self,
        user_mood: str,
        candidate_places: List,  # Can be List[Dict] or Django QuerySet
        user_interests: List[str],
        user_budget: str,
        user_pace: str = 'BALANCED',
        day_index: int = 0,
        trip_total_days: int = 7,
        current_location: Tuple[float, float] = None,
        hotel_location: Tuple[float, float] = None,
        previously_visited: List[str] = None,
        use_ml: bool = True
    ) -> List[RankedPlace]:
        """
        Rank places using ML model or rule-based scoring.
        
        Args:
            user_mood: User's selected mood
            candidate_places: List of place dicts or Django Place instances
            user_interests: User's interests
            user_budget: Budget level
            user_pace: Trip pace
            day_index: Day number in trip (0-indexed)
            trip_total_days: Total days in trip
            current_location: (lat, lon) tuple
            hotel_location: (lat, lon) hotel position for distance calculation
            previously_visited: List of place IDs used in earlier days
            use_ml: Whether to use ML model
            
        Returns:
            List of RankedPlace objects sorted by score (descending)
        """
        import time
        start_time = time.time()
        
        ranked_places = []
        
        # Debug: print user input to verify personalization signals
        logger.info(f"=== RANKING FOR USER ===")
        logger.info(f"USER_MOOD: {user_mood}")
        logger.info(f"USER_INTERESTS: {user_interests}")
        logger.info(f"USER_BUDGET: {user_budget}")
        logger.info(f"USER_PACE: {user_pace}")
        
        # STEP 2: Get HF scores once for all places (batch)
        hf_scores = {}
        if self.hf_ranker:
            try:
                hf_scores = self.hf_ranker.rank_places(
                    user_mood=user_mood,
                    user_interests=user_interests or [],
                    user_budget=user_budget,
                    user_pace=user_pace,
                    candidate_places=candidate_places
                )
                logger.info(f"HF SCORES CALCULATED: {len(hf_scores)} places")
                if hf_scores:
                    sample_place_id = list(hf_scores.keys())[0]
                    logger.info(f"  Sample HF score ({sample_place_id}): {hf_scores[sample_place_id]:.4f}")
            except Exception as e:
                logger.warning(f"HF scoring failed: {e}")
                hf_scores = {}
        
        for place in candidate_places:
            place_id = self._get_place_attr(place, 'id')
            place_name = self._get_place_attr(place, 'name')
            
            # Extract features in training order
            features = self._extract_features(
                user_mood=user_mood,
                user_budget=user_budget,
                user_pace=user_pace,
                user_interests=user_interests,
                place=place,
                day_index=day_index,
                trip_total_days=trip_total_days,
                hotel_location=hotel_location,
                previously_visited=previously_visited or []
            )
            
            # Get component scores
            ml_score = 0.0
            fallback_score = 0.0
            
            if use_ml and self.model and self.scaler:
                ml_score, confidence = self._get_ml_score(features)
            else:
                fallback_score, confidence = self._get_fallback_score(features)
            
            # Get HF score
            hf_score = hf_scores.get(place_id, 0.5)  # default to neutral
            
            # If no ML model, use fallback as primary
            if ml_score == 0.0 and fallback_score == 0.0:
                fallback_score, _ = self._get_fallback_score(features)
            
            # COMBINED SCORE FORMULA:
            # 0.55 * ML_score + 0.35 * HF_score + 0.10 * fallback_score
            final_score = (
                0.55 * ml_score +           # Structural patterns from LGB
                0.35 * hf_score +           # Semantic similarity from HF
                0.10 * fallback_score       # Rule-based fallback
            )
            
            # Debug first 3 places
            if len(ranked_places) < 3:
                logger.info(f"  Place '{place_name}': ML={ml_score:.3f}, HF={hf_score:.3f}, Fallback={fallback_score:.3f} → FINAL={final_score:.3f}")
            
            # Apply diversity penalty
            if place_id in (previously_visited or []):
                days_ago = day_index
                diversity_penalty = 0.8 ** max(days_ago, 1)
                final_score *= (1 - diversity_penalty * 0.2)
            
            ranked_places.append(RankedPlace(
                place_id=place_id,
                place_name=place_name,
                score=final_score,
                confidence=confidence,
                is_ml_ranked=use_ml and self.model is not None
            ))
        
        # Sort by score descending
        ranked_places.sort(key=lambda p: p.score, reverse=True)
        
        # Record stats
        self.last_confidence = np.mean([p.confidence for p in ranked_places]) if ranked_places else 0.0
        self.inference_latency_ms = (time.time() - start_time) * 1000
        
        logger.debug(
            f"Ranked {len(ranked_places)} places for mood={user_mood}, "
            f"day={day_index}, latency={self.inference_latency_ms:.1f}ms"
        )
        
        return ranked_places
    
    def _extract_features(
        self,
        user_mood: str,
        user_budget: str,
        user_pace: str,
        user_interests: List[str],
        place: Dict,
        day_index: int,
        trip_total_days: int,
        hotel_location: Tuple[float, float],
        previously_visited: List[str]
    ) -> np.ndarray:
        """
        Extract features in the same order as training pipeline.
        Returns: [17,] array matching FEATURE_COLUMNS from training.
        """
        
        # User features
        user_mood_id = self.MOOD_TO_ID.get(user_mood.upper(), 0)
        user_budget_id = self.BUDGET_TO_ID.get(user_budget.upper(), 0)
        user_pace_id = self.PACE_TO_ID.get(user_pace.upper(), 0)
        user_interests_count = len(user_interests) if user_interests else 0
        
        # Place features
        place_category = self._get_place_attr(place, 'category', 'other').lower()
        place_category_id = self.CATEGORY_TO_ID.get(place_category, 7)
        place_rating = (self._get_place_attr(place, 'average_rating') or self._get_place_attr(place, 'rating', 3.5)) / 5.0
        place_budget_id = self.BUDGET_TO_ID.get((self._get_place_attr(place, 'budget_level', 'MEDIUM') or 'MEDIUM').upper(), 0)
        place_visit_minutes = (self._get_place_attr(place, 'estimated_visit_minutes', 90) or 90) / 300.0
        place_tags = self._get_place_attr(place, 'tags', []) or []
        place_tags_count = len(place_tags) if place_tags else 0
        place_ideal_start = (self._get_place_attr(place, 'ideal_start_hour', 9) or 9) / 24.0
        place_ideal_end = (self._get_place_attr(place, 'ideal_end_hour', 18) or 18) / 24.0
        
        # Contextual features
        trip_day = day_index / max(trip_total_days, 1)
        trip_total_days_norm = trip_total_days / 7.0  # Normalize typical trip is 7 days
        
        # Geographic
        distance_km = 0.0
        place_lat = self._get_place_attr(place, 'latitude')
        place_lng = self._get_place_attr(place, 'longitude')
        if hotel_location and place_lat and place_lng:
            distance_km = self._haversine_distance(
                hotel_location[0], hotel_location[1],
                place_lat, place_lng
            )
        distance_km_norm = distance_km / 100.0  # Normalize
        
        # Interaction features
        user_interests_match = 1.0 if (
            user_interests and place_tags and
            any(tag.lower() in [i.lower() for i in user_interests] for tag in place_tags)
        ) else 0.0
        
        budget_match = 1.0 if (
            place_budget_id <= user_budget_id
        ) else 0.0
        
        place_is_cultural = place_category in ['religious', 'history', 'culture']
        mood_is_cultural = user_mood.upper() in ['SPIRITUAL', 'HISTORICAL']
        cultural_match = 1.0 if place_is_cultural and mood_is_cultural else 0.0
        
        # Build feature vector in EXACT order from training
        features = np.array([
            user_mood_id,
            user_budget_id,
            user_pace_id,
            user_interests_count,
            place_category_id,
            place_rating,
            place_budget_id,
            place_visit_minutes,
            place_tags_count,
            place_ideal_start,
            place_ideal_end,
            trip_day,
            trip_total_days_norm,
            distance_km_norm,
            user_interests_match,
            budget_match,
            cultural_match,
        ], dtype=np.float32)
        
        return features
    
    def _get_ml_score(self, features: np.ndarray) -> Tuple[float, float]:
        """Get score from trained ML model"""
        try:
            if self.model is None or self.scaler is None:
                raise ValueError("Model not loaded")
            
            # Normalize features
            features_scaled = self.scaler.transform(features.reshape(1, -1))
            
            # Get prediction
            score = self.model.predict(features_scaled)[0]
            
            # Sigmoid transform to [0, 1]
            score = 1.0 / (1.0 + np.exp(-score))
            
            # Confidence based on distance from 0.5
            confidence = min(abs(score - 0.5) * 2, 0.95)
            
            return float(score), float(confidence)
        except Exception as e:
            logger.warning(f"ML scoring failed: {e}. Using fallback.")
            return self._get_fallback_score_from_array(features)
    
    def _get_fallback_score(self, features: RankingFeatures) -> Tuple[float, float]:
        """Fallback rule-based scoring when ML model unavailable."""
        score = 0.0
        
        score += (features.rating / 5.0) * 0.3
        score += (features.popularity_score / 100.0) * 0.2
        
        interest_match = features.interest_tags[0] if features.interest_tags else 0
        score += interest_match * 0.25
        
        if features.is_cultural:
            score += 0.08
        if features.is_outdoor and features.day_index % 2 == 0:
            score += 0.07
        
        score += features.opening_hours_match * 0.1
        
        distance_penalty = min(features.distance_from_hotel / 20.0, 0.2)
        score -= distance_penalty * 0.1
        
        score = max(0.0, min(score, 1.0))
        confidence = 0.5
        
        return score, confidence
    
    def _get_fallback_score_from_array(self, features: np.ndarray) -> Tuple[float, float]:
        """Fallback scoring from feature array"""
        # Use training pipeline order:
        # [mood_id, budget_id, pace_id, interests_count, category_id, rating, 
        #  budget_id, visit_minutes, tags_count, ideal_start, ideal_end, 
        #  trip_day, trip_days, distance, interests_match, budget_match, cultural_match]
        
        score = 0.0
        
        # Rating (normalized 0-1, position 5)
        score += features[5] * 0.30
        
        # User interests match (position 14)
        score += features[14] * 0.25
        
        # Budget match (position 15)
        score += features[15] * 0.20
        
        # Cultural match (position 16)
        score += features[16] * 0.15
        
        # Distance penalty (position 13, normalized)
        distance_penalty = min(features[13], 0.2)
        score -= distance_penalty * 0.1
        
        score = max(0.0, min(score, 1.0))
        confidence = 0.5
        
        return score, confidence
    
    @staticmethod
    def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance in km between two lat/lon points"""
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371
        
        lat1_rad, lon1_rad = radians(lat1), radians(lon1)
        lat2_rad, lon2_rad = radians(lat2), radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = sin(dlat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        return R * c
