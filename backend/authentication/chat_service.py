import logging
import requests
import json
from django.conf import settings

logger = logging.getLogger(__name__)

# Lazy import emotion service - will be imported only when needed
_emotion_service = None
_EMOTION_SERVICE_AVAILABLE = True  # Assume available, check on first use


def _get_emotion_service():
    """Lazy load emotion service on first use"""
    global _emotion_service, _EMOTION_SERVICE_AVAILABLE
    
    if _emotion_service is not None:
        return _emotion_service
    
    try:
        from .emotion_service import emotion_service
        _emotion_service = emotion_service
        _EMOTION_SERVICE_AVAILABLE = True
        return _emotion_service
    except Exception as e:
        logger.warning(f"Could not import emotion service: {e}")
        _EMOTION_SERVICE_AVAILABLE = False
        return None


def get_ai_response(message):
    """Get response from AI using emotion detection and smart recommendations."""
    
    # Detect emotion for context
    detected_emotion = None
    emotion_confidence = 0.0
    
    emotion_service = _get_emotion_service()
    if emotion_service and _EMOTION_SERVICE_AVAILABLE:
        try:
            detected_emotion, emotion_confidence = emotion_service.detect_emotion(message)
            logger.info(f"Detected emotion: {detected_emotion} (confidence: {emotion_confidence:.2f})")
        except Exception as e:
            logger.warning(f"Emotion detection failed: {str(e)}")
    
    # Use intelligent fallback with emotion awareness
    logger.info("Using emotion-aware response system")
    return {
        'status': 'success',
        'reply': get_emotion_based_fallback(message, detected_emotion, emotion_confidence),
        'emotion_detected': detected_emotion if emotion_confidence > 0.4 else None,
        'confidence': emotion_confidence if emotion_confidence > 0.4 else None
    }


def get_gemini_response(message, detected_emotion=None, emotion_confidence=0.0):
    """Get response from Google Gemini with emotion context."""
    
    # Using Google's Gemini API (v1beta)
    api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
    
    # Build emotion-aware context
    emotion_context = ""
    if detected_emotion and emotion_confidence > 0.4:
        emotion_context = f"\n\nIMPORTANT: The user is feeling {detected_emotion} (confidence: {emotion_confidence:.0%}). "
        
        if detected_emotion in ['stress', 'anxiety']:
            emotion_context += "Suggest peaceful, relaxing hotels with spa/wellness facilities. Recommend calm activities and serene locations."
        elif detected_emotion == 'joy':
            emotion_context += "The user is excited! Suggest vibrant, energetic hotels in city centers. Recommend exciting activities and lively places."
        elif detected_emotion in ['sadness', 'disappointment']:
            emotion_context += "Be empathetic and uplifting. Suggest comforting hotels with cozy atmosphere. Recommend uplifting activities."
        elif detected_emotion == 'anger':
            emotion_context += "Be understanding and calm. Suggest peaceful retreats and quiet hotels. Recommend stress-relief activities."
    
    system_context = f"""You are a helpful travel assistant for Travello, a travel booking platform in Pakistan.

Key information:
- Travello offers hotel bookings in Lahore, Karachi, Islamabad and worldwide
- Users can search hotels by dates, guests, and room type
- Prices shown in PKR (Pakistani Rupees)
- Platform has: Hotels, Flights, Sightseeing, Bookings sections

Be friendly, helpful and give personalized recommendations based on user's emotional state.
Keep responses concise (3-5 sentences) unless detailed information is requested.
Always suggest specific hotels with approximate prices.{emotion_context}"""

    full_prompt = f"{system_context}\n\nUser: {message}\n\nAssistant:"
    
    try:
        # Get API key from settings
        gemini_api_key = getattr(settings, 'GEMINI_API_KEY', 'AIzaSyDfiav-yz_-ohmgB-Guu5Bpup2iR6pHAug')
        
        response = requests.post(
            f"{api_url}?key={gemini_api_key}",
            headers={'Content-Type': 'application/json'},
            json={
                "contents": [{
                    "parts": [{
                        "text": full_prompt
                    }]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 500,
                }
            },
            timeout=10
        )
        
        response.raise_for_status()
        data = response.json()
        
        reply = data['candidates'][0]['content']['parts'][0]['text'].strip()
        
        result = {
            'status': 'success',
            'reply': reply,
            'model': 'gemini-pro'
        }
        
        # Add emotion data if detected
        if detected_emotion and emotion_confidence > 0.4:
            result['emotion_detected'] = detected_emotion
            result['confidence'] = emotion_confidence
        
        return result
        
    except Exception as e:
        logger.error(f"Gemini API error: {str(e)}")
        raise


def get_groq_response(message):
    """Get response from Groq API (Llama 3 - Free & Fast)."""
    
    system_prompt = """You are a helpful travel assistant for Travello, a travel booking platform specializing in Pakistan and international destinations.

Your capabilities:
- Help users find hotels in Lahore, Karachi, Islamabad and other cities
- Provide travel tips and destination information
- Assist with booking questions (hotels, flights, sightseeing)
- Suggest tourist attractions and activities
- Share travel safety tips and requirements

Important context about Travello:
- We offer real-time hotel searches in major Pakistani cities
- Users can search hotels by entering dates, number of guests, and room type
- The platform has sections for: Hotels, Flights, Sightseeing, Bookings, and Journal
- Prices are shown in PKR (Pakistani Rupees)

Guidelines:
- Be friendly, professional, and helpful
- Keep responses concise (2-4 sentences for simple queries)
- For complex questions, provide structured information with bullet points
- If asked about prices, mention they vary by date and suggest using the search feature
- Always be encouraging about travel in Pakistan
- Use emojis sparingly for friendliness (1-2 per response max)

NEVER say you can't help or that you're just an AI. Always provide helpful information or guidance."""

    try:
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {settings.GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.1-70b-versatile',  # Fast & powerful
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': message}
                ],
                'temperature': 0.7,
                'max_tokens': 500,
                'top_p': 1,
                'stream': False
            },
            timeout=10
        )
        
        response.raise_for_status()
        data = response.json()
        
        return {
            'status': 'success',
            'reply': data['choices'][0]['message']['content'].strip(),
            'model': 'llama-3.1-70b'
        }
        
    except Exception as e:
        logger.error(f"Groq API error: {str(e)}")
        raise


def get_openai_response(message):
    """Get response from OpenAI GPT."""
    
    system_prompt = """You are a helpful travel assistant for Travello, a travel booking platform specializing in Pakistan and international destinations.

Your capabilities:
- Help users find hotels in Lahore, Karachi, Islamabad and other cities
- Provide travel tips and destination information
- Assist with booking questions
- Suggest tourist attractions and activities

Be friendly, concise, and helpful. Keep responses under 100 words for simple queries."""
    
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        return {
            'status': 'success',
            'reply': response.choices[0].message.content.strip(),
            'model': 'gpt-3.5-turbo'
        }
        
    except ImportError:
        import openai
        openai.api_key = settings.OPENAI_API_KEY
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        return {
            'status': 'success',
            'reply': response.choices[0].message.content.strip(),
            'model': 'gpt-3.5-turbo'
        }


def get_fallback_response(message):
    """Provide intelligent fallback responses when AI is not available."""
    message_lower = message.lower()
    
    # Hotel related queries
    if any(word in message_lower for word in ['hotel', 'accommodation', 'stay', 'room']):
        return """I can help you find hotels! 🏨
        
To search for hotels:
1. Go to the Hotels section in the dashboard
2. Enter your destination
3. Select check-in and check-out dates
4. Choose number of guests and room type
5. Click 'Search Hotels' to see available options

Popular destinations: Dubai, London, Paris, New York, Bangkok, Singapore"""
    
    # Flight related queries
    elif any(word in message_lower for word in ['flight', 'fly', 'plane', 'airline']):
        return """I can assist with flight bookings! ✈️
        
To search for flights:
1. Navigate to the Flights section
2. Enter departure and destination cities
3. Select travel dates
4. Choose number of passengers
5. Search for available flights

Tip: Book in advance for better prices!"""
    
    # Sightseeing/activities
    elif any(word in message_lower for word in ['sightseeing', 'tour', 'activity', 'attraction', 'visit', 'see']):
        return """Discover amazing places! 🗺️
        
Check out our Sightseeing section for:
- Popular tourist attractions
- Local tours and activities
- Cultural experiences
- Adventure activities
- Food tours

Each destination has unique experiences waiting for you!"""
    
    # Booking management
    elif any(word in message_lower for word in ['booking', 'reservation', 'manage', 'cancel', 'modify']):
        return """Manage your bookings easily! 📋
        
In the Bookings section you can:
- View all your reservations
- Check booking details
- Modify or cancel bookings
- Download booking confirmations
- Contact support for assistance

Your travel plans, all in one place!"""
    
    # Greeting
    elif any(word in message_lower for word in ['hello', 'hi', 'hey', 'greetings']):
        return """Hello! 👋 Welcome to Travello!

I'm here to help you with:
✈️ Flight bookings
🏨 Hotel reservations
🗺️ Sightseeing tours
📋 Managing your bookings

What would you like to explore today?"""
    
    # Help/general
    elif any(word in message_lower for word in ['help', 'assist', 'support', 'how']):
        return """I'm here to help! 🤝

Travello offers:
🏨 Hotels - Find and book accommodations worldwide
✈️ Flights - Search and book flights easily
🗺️ Sightseeing - Discover tours and activities
📋 Bookings - Manage all your reservations

Use the dashboard to explore these features. What can I help you with?"""
    
    # Default response
    else:
        return """Thank you for your message! 😊

I'm Travello Assistant, here to help with your travel needs:
- Hotel bookings
- Flight reservations
- Sightseeing tours
- Travel planning

Please use the dashboard features to search and book, or ask me specific questions about hotels, flights, or activities!

What would you like to know?"""


def get_emotion_based_fallback(message, emotion, confidence):
    """Generate emotion-aware responses without external APIs."""
    
    message_lower = message.lower()
    
    # High confidence emotion detected
    if emotion and confidence > 0.6:
        
        if emotion in ['anger', 'angry']:
            return """I understand you're feeling frustrated. Let me help you find a peaceful getaway to help you relax. 🌿

For calming experiences in Lahore, I recommend:

🏨 **Peaceful Hotels:**
- Pearl Continental (PKR 35,000/night) - Spa & wellness center
- Avari Hotel (PKR 28,000/night) - Quiet, elegant atmosphere
- Royal Palm Golf Club (PKR 45,000/night) - Serene golf resort

🌳 **Relaxing Activities:**
- Visit Shalimar Gardens for peaceful walks
- Enjoy spa treatments at luxury hotels
- Evening at Lahore Canal for fresh air

Would you like me to search for available dates?"""
        
        elif emotion in ['joy', 'happy', 'excited']:
            return """That's wonderful! Your positive energy is contagious! 🎉 Let me suggest some exciting places for your cheerful mood!

🏨 **Vibrant Hotels in Lahore:**
- Marriott Hotel (PKR 38,000/night) - Luxury in the city center
- Faletti's Hotel (PKR 30,000/night) - Historic & lively
- Luxus Grand Hotel (PKR 25,000/night) - Modern & social atmosphere

🎊 **Exciting Activities:**
- Explore Food Street for amazing local cuisine
- Visit Badshahi Mosque - breathtaking architecture
- Shop at Packages Mall or Liberty Market
- Enjoy the Sound & Light Show at Lahore Fort

Ready to book your adventure? Use the search feature to find the perfect hotel!"""
        
        elif emotion in ['sadness', 'sad', 'down']:
            return """I'm sorry you're feeling down. Sometimes a change of scenery can help lift our spirits. 💙

🏨 **Comforting Hotels:**
- Pearl Continental (PKR 35,000/night) - Warm, welcoming service
- Avari Hotel (PKR 28,000/night) - Cozy atmosphere
- Nishat Hotel (PKR 22,000/night) - Comfortable & affordable

🌟 **Uplifting Activities:**
- Visit Lahore Museum for cultural inspiration
- Enjoy traditional tea at a local café
- Peaceful walk in Lawrence Gardens
- Experience the beauty of Badshahi Mosque

Take your time, and remember that travel can be healing. How can I help you plan something special?"""
        
        elif emotion in ['stress', 'stressed', 'anxious']:
            return """I can sense you need some relaxation. Let me help you find the perfect stress-relief destination. 🧘

🏨 **Relaxing Hotels with Wellness:**
- Pearl Continental (PKR 35,000/night) - Full spa & massage services
- Avari Hotel (PKR 28,000/night) - Quiet rooms, excellent service
- Royal Palm Golf Club (PKR 45,000/night) - Spa, golf, peaceful environment

🌿 **Stress-Relief Activities:**
- Spa treatments and massages
- Yoga sessions (available at premium hotels)
- Peaceful walks in Shalimar Gardens
- Quiet evening by Lahore Canal

You deserve a break. Shall I search for peaceful accommodations for you?"""
    
    # Handle specific hotel/travel queries
    if any(word in message_lower for word in ['hotel', 'stay', 'accommodation', 'room']):
        if 'lahore' in message_lower:
            return """Here are popular hotels in Lahore:

🏨 **Luxury Options:**
- Pearl Continental - PKR 35,000/night
- Marriott Hotel - PKR 38,000/night
- Avari Hotel - PKR 28,000/night

🏨 **Mid-Range Options:**
- Faletti's Hotel - PKR 30,000/night
- Luxus Grand Hotel - PKR 25,000/night
- Nishat Hotel - PKR 22,000/night

All include WiFi, parking, and excellent service. Use the Hotels section to search by your dates and preferences!

Need help with booking?"""
        else:
            return """I can help you find hotels! 🏨

Travello offers accommodations in:
- Lahore, Karachi, Islamabad (Pakistan)
- International destinations worldwide

Simply use the Hotels search feature:
1. Enter your destination
2. Select check-in/check-out dates
3. Choose number of guests
4. Browse and book!

Which city are you interested in?"""
    
    # Default fallback
    return get_fallback_response(message)