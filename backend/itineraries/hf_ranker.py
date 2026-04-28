"""
Layer 2.5: HuggingFace Embeddings Ranker

Semantic similarity-based ranking using sentence-transformers.
Complements LightGBM by understanding semantic relationships between
user preferences and place characteristics.

Uses: sentence-transformers/all-MiniLM-L6-v2 (33M parameters)
"""

import logging
import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Cache encoder instances so the heavy transformer model is loaded once per process.
_HF_RANKER_CACHE = {}

# Try importing sentence-transformers first
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    SentenceTransformer = None

# Fallback: plain transformers encoder (works without sentence-transformers package)
try:
    import torch
    from transformers import AutoTokenizer, AutoModel
    TRANSFORMERS_ENCODER_AVAILABLE = True
except ImportError:
    TRANSFORMERS_ENCODER_AVAILABLE = False
    torch = None
    AutoTokenizer = None
    AutoModel = None

HF_AVAILABLE = SENTENCE_TRANSFORMERS_AVAILABLE or TRANSFORMERS_ENCODER_AVAILABLE
if not HF_AVAILABLE:
    logger.warning("Neither sentence-transformers nor transformers encoder is available. HF ranking disabled.")
elif not SENTENCE_TRANSFORMERS_AVAILABLE:
    logger.warning("sentence-transformers not available. Using transformers encoder fallback for HF ranking.")


@dataclass
class HFRanking:
    """HuggingFace embedding-based ranking result"""
    place_id: int
    place_name: str
    user_embedding: np.ndarray
    place_embedding: np.ndarray
    cosine_similarity: float
    hf_score: float  # Normalized to [0, 1]


class HFPlaceRanker:
    """
    HuggingFace-based place ranker using semantic embeddings.
    
    Strategy:
    1. Encode user profile as text: "mood: historical, interests: culture history"
    2. Encode place as text: "Lahore Fort, Historical site, great for culture"
    3. Compute cosine similarity (semantic matching)
    4. Return score 0-1
    
    This is an ADDITIONAL intelligence layer that works WITH LightGBM.
    """
    
    # Model configuration
    MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
    FALLBACK_MODEL_NAME = "distilbert-base-uncased"
    EMBEDDING_DIM = 384  # Output dimension
    
    def __init__(self, model_name: str = None, device: str = "cpu"):
        """
        Initialize HuggingFace ranker.
        
        Args:
            model_name: HuggingFace model identifier
            device: "cpu" or "cuda"
        """
        self.model_name = model_name or self.MODEL_NAME
        self.device = device
        self.model = None
        self.tokenizer = None
        self.model_loaded = False
        self.encoder_type = None
        
        if HF_AVAILABLE:
            self._load_model()
        else:
            logger.warning("HF ranking not available. LightGBM will handle all ranking.")
    
    def _load_model(self):
        """Load encoder model (sentence-transformers preferred, transformers fallback)."""
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                logger.info(f"Loading HuggingFace model: {self.model_name}")
                self.model = SentenceTransformer(self.model_name, device=self.device)
                self.model_loaded = True
                self.encoder_type = 'sentence_transformers'
                logger.info(f"✓ HF sentence-transformers model loaded ({self.EMBEDDING_DIM}D embeddings)")
                return
            except Exception as e:
                logger.warning(f"Failed to load sentence-transformers model: {e}. Trying transformers fallback.")

        if TRANSFORMERS_ENCODER_AVAILABLE:
            try:
                logger.info(f"Loading transformers fallback model: {self.FALLBACK_MODEL_NAME}")
                # Try local cache first to avoid slow network timeout on every startup.
                try:
                    self.tokenizer = AutoTokenizer.from_pretrained(
                        self.FALLBACK_MODEL_NAME, local_files_only=True
                    )
                    self.model = AutoModel.from_pretrained(
                        self.FALLBACK_MODEL_NAME, local_files_only=True
                    )
                except Exception:
                    logger.info(f"Model not in local cache, downloading {self.FALLBACK_MODEL_NAME}...")
                    self.tokenizer = AutoTokenizer.from_pretrained(self.FALLBACK_MODEL_NAME)
                    self.model = AutoModel.from_pretrained(self.FALLBACK_MODEL_NAME)
                self.model.eval()
                self.model_loaded = True
                self.encoder_type = 'transformers_fallback'
                logger.info("✓ HF transformers fallback model loaded")
                return
            except Exception as e:
                logger.error(f"Failed to load transformers fallback model: {e}")

        self.model = None
        self.tokenizer = None
        self.model_loaded = False
        self.encoder_type = None

    def _encode_text(self, text: str) -> Optional[np.ndarray]:
        """Encode text with whichever encoder backend is loaded."""
        if not self.model_loaded:
            return None

        if self.encoder_type == 'sentence_transformers':
            return self.model.encode(text, convert_to_numpy=True)

        if self.encoder_type == 'transformers_fallback':
            try:
                encoded = self.tokenizer(
                    text,
                    padding=True,
                    truncation=True,
                    max_length=128,
                    return_tensors='pt',
                )
                with torch.no_grad():
                    outputs = self.model(**encoded)
                    # Mean pooling over tokens with attention mask.
                    token_embeddings = outputs.last_hidden_state
                    attention_mask = encoded['attention_mask'].unsqueeze(-1)
                    masked = token_embeddings * attention_mask
                    summed = masked.sum(dim=1)
                    counts = attention_mask.sum(dim=1).clamp(min=1)
                    mean_pooled = summed / counts
                return mean_pooled[0].cpu().numpy()
            except Exception as e:
                logger.error(f"Error encoding text with transformers fallback: {e}")
                return None

        return None
    
    def _build_user_text(
        self,
        user_mood: str,
        user_interests: List[str],
        user_budget: str,
        user_pace: str
    ) -> str:
        """
        Build natural language text describing user profile.
        
        Example:
        "Looking for historical sites with culture and architecture interests.
         Medium budget, balanced pace trip."
        """
        mood_map = {
            'HISTORICAL': 'historical sites and monuments',
            'SPIRITUAL': 'spiritual locations and temples',
            'FOODIE': 'food restaurants and dining experiences',
            'SHOPPING': 'shopping malls and markets',
            'FAMILY': 'family-friendly parks and entertainment',
            'ROMANTIC': 'romantic scenic spots',
            'NATURE': 'nature parks and outdoor activities',
            'FUN': 'fun entertainment venues',
            'RELAXING': 'relaxing comfortable places',
        }
        
        mood_text = mood_map.get(user_mood.upper(), user_mood.lower())
        interests_text = ", ".join(user_interests) if user_interests else "general"
        
        text = (
            f"Looking for {mood_text}. "
            f"Interested in: {interests_text}. "
            f"Budget: {user_budget.lower()}. "
            f"Pace: {user_pace.lower()}."
        )
        
        return text
    
    def _build_place_text(self, place: Dict) -> str:
        """
        Build natural language text describing place.
        
        Works with both dict and Django model objects.
        
        Example:
        "Lahore Fort, historical monument, great for history and culture enthusiasts"
        """
        # Handle both dict and model attributes
        name = self._get_attr(place, 'name', 'Unknown Place')
        category = self._get_attr(place, 'category', 'general')
        rating = self._get_attr(place, 'average_rating') or self._get_attr(place, 'rating', 0)
        tags = self._get_attr(place, 'tags', []) or []
        
        # Build descriptive text
        rating_text = f"rated {rating}/5" if rating > 0 else "popular"
        
        tags_text = ", ".join(tags) if tags else category
        
        text = (
            f"{name}. "
            f"Category: {category}. "
            f"Description: {tags_text}. "
            f"Rating: {rating_text}."
        )
        
        return text
    
    @staticmethod
    def _get_attr(obj, attr: str, default=None):
        """Get attribute from dict or model object"""
        if hasattr(obj, 'get'):
            return obj.get(attr, default)
        return getattr(obj, attr, default)
    
    def encode_user_profile(
        self,
        user_mood: str,
        user_interests: List[str],
        user_budget: str,
        user_pace: str
    ) -> Optional[np.ndarray]:
        """
        Encode user profile to embedding vector.
        
        Returns:
            numpy array of shape (384,) or None if model not available
        """
        if not self.model_loaded:
            logger.debug("HF model not loaded, skipping user embedding")
            return None
        
        try:
            user_text = self._build_user_text(user_mood, user_interests, user_budget, user_pace)
            embedding = self._encode_text(user_text)
            return embedding
        except Exception as e:
            logger.error(f"Error encoding user profile: {e}")
            return None
    
    def encode_place(self, place: Dict) -> Optional[np.ndarray]:
        """
        Encode place to embedding vector.
        
        Returns:
            numpy array of shape (384,) or None if model not available
        """
        if not self.model_loaded:
            return None
        
        try:
            place_text = self._build_place_text(place)
            embedding = self._encode_text(place_text)
            return embedding
        except Exception as e:
            logger.error(f"Error encoding place: {e}")
            return None
    
    @staticmethod
    def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Compute cosine similarity between two vectors"""
        if vec1 is None or vec2 is None:
            return 0.5  # Neutral score
        
        # Normalize vectors
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        vec1_norm = vec1 / norm1
        vec2_norm = vec2 / norm2
        
        # Cosine similarity: -1 to 1, convert to 0-1
        similarity = np.dot(vec1_norm, vec2_norm)
        score = (similarity + 1) / 2  # Map [-1, 1] to [0, 1]
        
        return float(score)
    
    def rank_places(
        self,
        user_mood: str,
        user_interests: List[str],
        user_budget: str,
        user_pace: str,
        candidate_places: List[Dict]
    ) -> Dict[int, float]:
        """
        Rank places using semantic similarity.
        
        Args:
            user_mood: User's mood
            user_interests: User's interests
            user_budget: User's budget level
            user_pace: User's pace
            candidate_places: List of places to rank
        
        Returns:
            Dict mapping place_id -> hf_score (0-1)
        """
        if not self.model_loaded or not candidate_places:
            return {}
        
        try:
            # Encode user profile once
            user_embedding = self.encode_user_profile(
                user_mood, user_interests, user_budget, user_pace
            )
            
            if user_embedding is None:
                return {}
            
            # Score each place
            scores = {}
            for place in candidate_places:
                place_id = self._get_attr(place, 'id')
                if place_id is None:
                    continue
                
                # Encode place
                place_embedding = self.encode_place(place)
                
                # Compute similarity
                sim_score = self.cosine_similarity(user_embedding, place_embedding)
                scores[place_id] = float(sim_score)
            
            return scores
        
        except Exception as e:
            logger.error(f"Error ranking places with HF: {e}")
            return {}
    
    def get_hf_score(
        self,
        user_mood: str,
        user_interests: List[str],
        user_budget: str,
        user_pace: str,
        place: Dict
    ) -> float:
        """
        Get HuggingFace score for a single place.
        
        Args:
            user_mood: User mood
            user_interests: User interests
            user_budget: User budget
            user_pace: User pace
            place: Place dict/model
        
        Returns:
            Score 0-1 (or 0.5 if HF not available)
        """
        if not self.model_loaded:
            return 0.5  # Neutral fallback
        
        try:
            user_embedding = self.encode_user_profile(
                user_mood, user_interests, user_budget, user_pace
            )
            place_embedding = self.encode_place(place)
            
            score = self.cosine_similarity(user_embedding, place_embedding)
            return float(score)
        
        except Exception as e:
            logger.error(f"Error computing HF score: {e}")
            return 0.5


def create_hf_ranker(device: str = "cpu") -> Optional[HFPlaceRanker]:
    """
    Factory function to create HF ranker if available.
    
    Args:
        device: "cpu" or "cuda"
    
    Returns:
        HFPlaceRanker instance or None
    """
    if not HF_AVAILABLE:
        logger.warning("HuggingFace not available, using only LightGBM")
        return None

    cache_key = device or "cpu"
    cached_ranker = _HF_RANKER_CACHE.get(cache_key)
    if cached_ranker is not None:
        return cached_ranker
    
    try:
        ranker = HFPlaceRanker(device=device)
        if ranker.model_loaded:
            _HF_RANKER_CACHE[cache_key] = ranker
        return ranker
    except Exception as e:
        logger.error(f"Failed to create HF ranker: {e}")
        return None
