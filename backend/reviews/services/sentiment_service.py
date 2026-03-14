"""
Simple sentiment analysis service for review text.
Uses TextBlob if available, otherwise a keyword-based approach.
"""
import re
import logging

logger = logging.getLogger(__name__)

# Keyword lists for fallback sentiment analysis
POSITIVE_WORDS = {
    'amazing', 'awesome', 'beautiful', 'best', 'clean', 'comfortable',
    'convenient', 'cozy', 'delicious', 'delightful', 'excellent', 'exceptional',
    'fabulous', 'fantastic', 'friendly', 'gorgeous', 'great', 'helpful',
    'impressive', 'incredible', 'lovely', 'luxurious', 'magnificent',
    'marvelous', 'nice', 'outstanding', 'perfect', 'pleasant', 'polite',
    'professional', 'quiet', 'recommend', 'relaxing', 'romantic', 'spacious',
    'spotless', 'stunning', 'superb', 'terrific', 'wonderful', 'worth',
    'love', 'loved', 'enjoy', 'enjoyed', 'happy', 'pleased', 'satisfied',
}

NEGATIVE_WORDS = {
    'awful', 'bad', 'broken', 'cockroach', 'cold', 'complaint', 'cramped',
    'dangerous', 'dirty', 'disappoint', 'disappointed', 'disappointing',
    'disgusting', 'dreadful', 'filthy', 'horrible', 'horrendous', 'loud',
    'mold', 'mouldy', 'nasty', 'nightmare', 'noisy', 'odor', 'overpriced',
    'poor', 'rude', 'rundown', 'rust', 'shabby', 'smell', 'stain', 'stained',
    'terrible', 'tiny', 'uncomfortable', 'unfriendly', 'unhygienic', 'unpleasant',
    'worst', 'hate', 'hated', 'angry', 'annoyed', 'frustrated', 'regret',
}

NEGATION_WORDS = {'not', "n't", 'no', 'never', 'neither', 'nor', 'hardly', 'barely'}


def analyze_sentiment(text):
    """
    Analyze sentiment of review text.
    Returns dict with 'sentiment' ('positive'|'neutral'|'negative') and 'score' (-1.0 to 1.0).
    """
    if not text or not isinstance(text, str):
        return {'sentiment': 'neutral', 'score': 0.0}

    # Try TextBlob first
    try:
        from textblob import TextBlob  # type: ignore[import-not-found]
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity  # -1.0 to 1.0

        if polarity > 0.1:
            sentiment = 'positive'
        elif polarity < -0.1:
            sentiment = 'negative'
        else:
            sentiment = 'neutral'

        return {'sentiment': sentiment, 'score': round(polarity, 3)}
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"TextBlob sentiment analysis failed: {e}")

    # Fallback: keyword-based
    return _keyword_sentiment(text)


def _keyword_sentiment(text):
    """Simple keyword-based sentiment analysis as fallback."""
    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    pos_count = 0
    neg_count = 0
    negate = False

    for word in words:
        if word in NEGATION_WORDS or word.endswith("n't"):
            negate = True
            continue

        if word in POSITIVE_WORDS:
            if negate:
                neg_count += 1
            else:
                pos_count += 1
            negate = False
        elif word in NEGATIVE_WORDS:
            if negate:
                pos_count += 1
            else:
                neg_count += 1
            negate = False
        else:
            negate = False

    total = pos_count + neg_count
    if total == 0:
        return {'sentiment': 'neutral', 'score': 0.0}

    score = (pos_count - neg_count) / total  # -1.0 to 1.0

    if score > 0.15:
        sentiment = 'positive'
    elif score < -0.15:
        sentiment = 'negative'
    else:
        sentiment = 'neutral'

    return {'sentiment': sentiment, 'score': round(score, 3)}
