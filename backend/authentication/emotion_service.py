"""
Emotion Detection and Hotel Recommendation Service
Uses Hugging Face transformers for emotion detection (lazy loading)
Provides emotion-based hotel and tourist place recommendations
"""

import logging
from typing import Dict, List, Tuple
import json

logger = logging.getLogger(__name__)

# Lazy import flag
_EMOTION_MODEL_LOADED = False
_EMOTION_MODEL_AVAILABLE = False


class EmotionAwareRecommendationService:
    """
    Service for detecting emotions and providing contextual recommendations
    Uses lazy loading for ML libraries
    """
    
    def __init__(self):
        self.emotion_classifier = None
        
    def _lazy_initialize_model(self):
        """Lazy initialize the emotion detection model only when needed"""
        global _EMOTION_MODEL_LOADED, _EMOTION_MODEL_AVAILABLE
        
        if _EMOTION_MODEL_LOADED:
            return self.emotion_classifier is not None
            
        _EMOTION_MODEL_LOADED = True
        
        try:
            # Import only when needed
            from transformers import pipeline
            import torch
            
            # Use a lightweight emotion detection model
            self.emotion_classifier = pipeline(
                "text-classification",
                model="j-hartmann/emotion-english-distilroberta-base",
                return_all_scores=False,
                device=-1  # Use CPU
            )
            _EMOTION_MODEL_AVAILABLE = True
            logger.info("Emotion classifier initialized (lazy loaded)")
            return True
        except Exception as e:
            logger.warning(f"Emotion model not available: {e}")
            _EMOTION_MODEL_AVAILABLE = False
            return False
    
    def detect_emotion(self, text: str) -> Tuple[str, float]:
        """
        Detect emotion from text
        
        Args:
            text: User's message
            
        Returns:
            Tuple of (emotion, confidence)
        """
        # Lazy load the model
        model_available = self._lazy_initialize_model()
        
        if model_available and self.emotion_classifier:
            try:
                result = self.emotion_classifier(text)[0]
                emotion = result['label']
                confidence = result['score']
                
                logger.info(f"Detected emotion: {emotion} (confidence: {confidence:.2f})")
                return emotion, confidence
                
            except Exception as e:
                logger.error(f"Error detecting emotion: {e}")
                return self._detect_emotion_keywords(text)
        else:
            # Fallback to keyword-based detection
            return self._detect_emotion_keywords(text)
    
    def _detect_emotion_keywords(self, text: str) -> Tuple[str, float]:
        """
        Fallback emotion detection using keywords
        """
        text_lower = text.lower()
        
        # Emotion keywords mapping
        emotion_keywords = {
            'stress': ['stress', 'stressed', 'anxious', 'worried', 'overwhelmed', 'pressure', 'tense'],
            'sadness': ['sad', 'depressed', 'unhappy', 'down', 'upset', 'disappointed'],
            'anger': ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'irritated'],
            'fear': ['scared', 'afraid', 'nervous', 'terrified', 'panic', 'frightened'],
            'joy': ['happy', 'excited', 'joyful', 'thrilled', 'delighted', 'cheerful', 'amazing'],
            'surprise': ['surprised', 'shocked', 'astonished', 'amazed', 'unexpected'],
            'neutral': ['okay', 'fine', 'alright', 'normal']
        }
        
        detected_emotions = {}
        for emotion, keywords in emotion_keywords.items():
            count = sum(1 for keyword in keywords if keyword in text_lower)
            if count > 0:
                detected_emotions[emotion] = count
        
        if detected_emotions:
            # Return emotion with highest count
            emotion = max(detected_emotions, key=detected_emotions.get)
            confidence = min(detected_emotions[emotion] * 0.3, 0.9)
            return emotion, confidence
        
        return 'neutral', 0.5
    
    def get_emotion_based_recommendations(self, emotion: str, city: str = "Lahore") -> Dict:
        """
        Get hotel and tourist place recommendations based on detected emotion
        
        Args:
            emotion: Detected emotion (stress, joy, sadness, etc.)
            city: City for recommendations (default: Lahore)
            
        Returns:
            Dictionary with recommendations, suggestions, and response tone
        """
        
        emotion_lower = emotion.lower()
        
        # Emotion-specific recommendations
        if 'stress' in emotion_lower or 'anxious' in emotion_lower:
            return {
                'emotion': 'stress',
                'message': "I sense you're feeling stressed. Let me help you find relaxing places!",
                'tone': 'calm_supportive',
                'tourist_places': [
                    {
                        'name': 'Jilani Park (Race Course Park)',
                        'reason': 'Peaceful green space perfect for relaxation and unwinding',
                        'activities': ['Nature walks', 'Boat rides', 'Quiet spots for meditation'],
                        'stress_level': 'Low'
                    },
                    {
                        'name': 'Shalimar Gardens',
                        'reason': 'UNESCO World Heritage site with serene Mughal gardens',
                        'activities': ['Peaceful walks', 'Photography', 'Historical exploration'],
                        'stress_level': 'Very Low'
                    },
                    {
                        'name': 'Lahore Canal',
                        'reason': 'Long scenic route ideal for peaceful walks or cycling',
                        'activities': ['Evening strolls', 'Jogging', 'Fresh air'],
                        'stress_level': 'Low'
                    },
                    {
                        'name': 'Jallo Park',
                        'reason': 'Large wildlife park with natural surroundings',
                        'activities': ['Wildlife watching', 'Picnics', 'Nature therapy'],
                        'stress_level': 'Very Low'
                    }
                ],
                'hotels': [
                    {
                        'name': 'Royal Palm Golf & Country Club',
                        'reason': 'Luxury resort with spa, golf, and tranquil environment',
                        'amenities': ['World-class spa', 'Golf course', 'Swimming pools', 'Quiet rooms'],
                        'price': 'PKR 45,000/night',
                        'stress_relief': 'Excellent'
                    },
                    {
                        'name': 'Pearl Continental Hotel Lahore',
                        'reason': 'Premium hotel with spa and wellness facilities',
                        'amenities': ['Spa', 'Massage services', 'Rooftop restaurant', 'Gym'],
                        'price': 'PKR 35,000/night',
                        'stress_relief': 'Very Good'
                    },
                    {
                        'name': 'Avari Hotel Lahore',
                        'reason': 'Elegant hotel with peaceful ambiance',
                        'amenities': ['Quiet atmosphere', 'Spa services', 'Fine dining'],
                        'price': 'PKR 28,000/night',
                        'stress_relief': 'Good'
                    }
                ],
                'advice': [
                    "Take time to breathe and relax",
                    "Visit these peaceful locations during early morning or evening",
                    "Consider booking a spa treatment at your hotel",
                    "Try local herbal teas to help you unwind"
                ]
            }
        
        elif 'joy' in emotion_lower or 'happy' in emotion_lower or 'excited' in emotion_lower:
            return {
                'emotion': 'joy',
                'message': "You seem excited! Let me suggest some vibrant places to match your energy!",
                'tone': 'enthusiastic',
                'tourist_places': [
                    {
                        'name': 'Badshahi Mosque',
                        'reason': 'Magnificent Mughal architecture, truly awe-inspiring!',
                        'activities': ['Photography', 'Historical tours', 'Cultural exploration'],
                        'energy_level': 'High'
                    },
                    {
                        'name': 'Lahore Fort',
                        'reason': 'Stunning UNESCO site with amazing history',
                        'activities': ['Exploring palaces', 'Light shows', 'Museum visits'],
                        'energy_level': 'High'
                    },
                    {
                        'name': 'Food Street (Gawalmandi)',
                        'reason': 'Vibrant food scene with incredible local cuisine',
                        'activities': ['Food tasting', 'Cultural immersion', 'Night life'],
                        'energy_level': 'Very High'
                    },
                    {
                        'name': 'Packages Mall / Emporium Mall',
                        'reason': 'Modern shopping and entertainment hub',
                        'activities': ['Shopping', 'Dining', 'Entertainment', 'Cinema'],
                        'energy_level': 'High'
                    }
                ],
                'hotels': [
                    {
                        'name': 'Marriott Hotel Lahore',
                        'reason': 'Luxury hotel near major attractions with vibrant atmosphere',
                        'amenities': ['Multiple restaurants', 'Pool', 'Gym', 'Event spaces'],
                        'price': 'PKR 38,000/night',
                        'vibe': 'Luxurious & Lively'
                    },
                    {
                        'name': 'Crowne Plaza Lahore',
                        'reason': 'Modern hotel with great location for exploring',
                        'amenities': ['Rooftop restaurant', 'Spa', 'Business center'],
                        'price': 'PKR 32,000/night',
                        'vibe': 'Contemporary & Energetic'
                    },
                    {
                        'name': 'Luxus Grand Hotel',
                        'reason': 'Stylish hotel in the heart of Gulberg',
                        'amenities': ['Trendy design', 'Restaurant', 'WiFi', 'Central location'],
                        'price': 'PKR 25,000/night',
                        'vibe': 'Modern & Social'
                    }
                ],
                'advice': [
                    "Make the most of your positive energy!",
                    "Try traditional Lahori food at Food Street",
                    "Visit Badshahi Mosque during sunset for stunning views",
                    "Don't miss the sound and light show at Lahore Fort"
                ]
            }
        
        elif 'sad' in emotion_lower or 'down' in emotion_lower:
            return {
                'emotion': 'sadness',
                'message': "I'm here to help cheer you up! Here are some uplifting places.",
                'tone': 'supportive_gentle',
                'tourist_places': [
                    {
                        'name': 'Lahore Zoo',
                        'reason': 'Animals and nature can be therapeutic and uplifting',
                        'activities': ['Animal watching', 'Walking', 'Fresh air'],
                        'mood_boost': 'Moderate'
                    },
                    {
                        'name': 'Greater Iqbal Park',
                        'reason': 'Beautiful open spaces with fountains and greenery',
                        'activities': ['Relaxing walks', 'People watching', 'Photography'],
                        'mood_boost': 'Good'
                    },
                    {
                        'name': 'Alhamra Arts Council',
                        'reason': 'Cultural center with art exhibitions and performances',
                        'activities': ['Art appreciation', 'Theater', 'Cultural events'],
                        'mood_boost': 'Good'
                    },
                    {
                        'name': 'Sozo Water Park',
                        'reason': 'Fun water park to boost your spirits',
                        'activities': ['Water slides', 'Swimming', 'Entertainment'],
                        'mood_boost': 'High'
                    }
                ],
                'hotels': [
                    {
                        'name': 'Pearl Continental Hotel Lahore',
                        'reason': 'Comfortable stay with comforting amenities',
                        'amenities': ['Comfortable rooms', 'In-room dining', 'Entertainment'],
                        'price': 'PKR 35,000/night',
                        'comfort_level': 'Excellent'
                    },
                    {
                        'name': 'Nishat Hotel Johar Town',
                        'reason': 'Cozy atmosphere with friendly service',
                        'amenities': ['Warm hospitality', 'Restaurant', 'Quiet environment'],
                        'price': 'PKR 18,000/night',
                        'comfort_level': 'Very Good'
                    }
                ],
                'advice': [
                    "Remember, it's okay to not feel okay sometimes",
                    "A change of scenery can help improve your mood",
                    "Consider talking to the friendly hotel staff",
                    "Take it one day at a time"
                ]
            }
        
        else:  # neutral or other emotions
            return {
                'emotion': 'neutral',
                'message': "Let me show you some popular places and hotels in Lahore!",
                'tone': 'informative',
                'tourist_places': [
                    {
                        'name': 'Badshahi Mosque',
                        'reason': 'Iconic Lahore landmark and architectural marvel',
                        'activities': ['Sightseeing', 'Photography', 'History'],
                        'rating': 9.5
                    },
                    {
                        'name': 'Lahore Fort',
                        'reason': 'UNESCO World Heritage Site',
                        'activities': ['Historical tours', 'Museums', 'Light shows'],
                        'rating': 9.3
                    },
                    {
                        'name': 'Minar-e-Pakistan',
                        'reason': 'National monument in Greater Iqbal Park',
                        'activities': ['Sightseeing', 'Picnics', 'Evening visits'],
                        'rating': 8.8
                    },
                    {
                        'name': 'Wazir Khan Mosque',
                        'reason': 'Beautiful Mughal-era mosque with intricate tiles',
                        'activities': ['Architecture', 'Photography', 'Culture'],
                        'rating': 9.0
                    }
                ],
                'hotels': [
                    {
                        'name': 'Pearl Continental Hotel Lahore',
                        'reason': 'Top-rated luxury hotel',
                        'amenities': ['5-star service', 'Spa', 'Multiple restaurants'],
                        'price': 'PKR 35,000/night',
                        'rating': 9.2
                    },
                    {
                        'name': 'Avari Hotel Lahore',
                        'reason': 'Excellent location and service',
                        'amenities': ['Restaurant', 'Parking', 'WiFi'],
                        'price': 'PKR 28,000/night',
                        'rating': 8.8
                    },
                    {
                        'name': 'Ramada by Wyndham',
                        'reason': 'Good value with modern amenities',
                        'amenities': ['Pool', 'Gym', 'Business center'],
                        'price': 'PKR 20,000/night',
                        'rating': 8.4
                    }
                ],
                'advice': [
                    "Lahore is known as the 'Heart of Pakistan'",
                    "Best time to visit is October to March",
                    "Try local cuisine at Food Street",
                    "Book hotels in advance during peak season"
                ]
            }
    
    def generate_emotion_aware_response(self, user_message: str, city: str = "Lahore") -> str:
        """
        Generate a complete emotion-aware response with recommendations
        
        Args:
            user_message: User's chat message
            city: City for recommendations
            
        Returns:
            Formatted response string with recommendations
        """
        # Detect emotion
        emotion, confidence = self.detect_emotion(user_message)
        
        # Get recommendations
        recommendations = self.get_emotion_based_recommendations(emotion, city)
        
        # Format response
        response = f"{recommendations['message']}\n\n"
        
        # Tourist Places
        response += "🏛️ **Recommended Tourist Places:**\n\n"
        for i, place in enumerate(recommendations['tourist_places'][:4], 1):
            response += f"{i}. **{place['name']}**\n"
            response += f"   {place['reason']}\n"
            response += f"   Activities: {', '.join(place['activities'])}\n\n"
        
        # Hotels
        response += "\n🏨 **Recommended Hotels:**\n\n"
        for i, hotel in enumerate(recommendations['hotels'][:3], 1):
            response += f"{i}. **{hotel['name']}** - {hotel['price']}\n"
            response += f"   {hotel['reason']}\n"
            response += f"   Amenities: {', '.join(hotel['amenities'])}\n\n"
        
        # Advice
        if 'advice' in recommendations and recommendations['advice']:
            response += "\n💡 **Helpful Tips:**\n"
            for tip in recommendations['advice'][:3]:
                response += f"• {tip}\n"
        
        response += "\n\nWould you like more details about any of these places or help with booking?"
        
        return response


# Singleton instance
emotion_service = EmotionAwareRecommendationService()
