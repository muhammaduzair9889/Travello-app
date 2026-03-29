"""
Basic content moderation for reviews.
Flags reviews containing profanity or suspicious patterns.
"""
import re
import logging

logger = logging.getLogger(__name__)

# Minimal blocklist — extend as needed
BLOCKED_PATTERNS = [
    r'\b(?:spam|scam|fake)\b',
]

# Words that should trigger a flag for manual review
FLAG_WORDS = [
    'lawsuit', 'legal action', 'health hazard', 'food poisoning',
    'bedbug', 'bed bug', 'cockroach', 'rat ',
]


def moderate_review(title, content):
    """
    Returns a dict with:
      - 'approved': bool — True if the review can be auto-published
      - 'flags': list of strings explaining any issues
    """
    flags = []
    text = f"{title} {content}".lower()

    # Check blocked patterns
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            flags.append(f"Matched blocked pattern: {pattern}")

    # Check flag words (don't block, just flag for review)
    for word in FLAG_WORDS:
        if word.lower() in text:
            flags.append(f"Contains flagged term: {word}")

    # Check for excessive caps (>50% caps in content longer than 20 chars)
    if len(content) > 20:
        alpha_chars = [c for c in content if c.isalpha()]
        if alpha_chars:
            caps_ratio = sum(1 for c in alpha_chars if c.isupper()) / len(alpha_chars)
            if caps_ratio > 0.5:
                flags.append("Excessive use of capital letters")

    # Check minimum content quality
    word_count = len(content.split())
    if word_count < 5:
        flags.append("Review content too short (less than 5 words)")

    approved = len(flags) == 0
    return {
        'approved': approved,
        'flags': flags,
    }
