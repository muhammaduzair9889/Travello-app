"""
AI-powered grammar & spelling checker for review text.

Primary:  Google Gemini API (same engine as the travel-journal feature).
Fallback: lightweight dictionary-based corrections if Gemini is unavailable.
"""
import re
import logging

logger = logging.getLogger(__name__)

# ── Gemini API ──────────────────────────────────────────────────────────────

GRAMMAR_SYSTEM_PROMPT = (
    "You are a precise proofreader for hotel and travel reviews. "
    "Correct ALL grammar, spelling, and punctuation errors in the user's text. "
    "Return ONLY the corrected text — no explanations, no commentary, "
    "no quotes around it. Preserve the original tone, meaning, and structure. "
    "If the text is already perfect, return it exactly unchanged."
)


def _call_gemini(text):
    """Send text to Gemini for grammar/spelling correction. Returns corrected
    text or None on failure."""
    try:
        from travello_backend.utils import call_gemini
        return call_gemini(
            system_instruction=GRAMMAR_SYSTEM_PROMPT,
            contents=[{"parts": [{"text": text}]}],
            temperature=0.1,
            max_tokens=2048,
        )
    except Exception as exc:
        logger.error("Gemini grammar-check failed: %s", exc)
        return None


# ── Public API ──────────────────────────────────────────────────────────────

def get_suggestions(text):
    """
    Return ``{corrected_text, has_corrections}`` using Gemini AI.

    Falls back to the dictionary approach if Gemini is unavailable,
    returning the same shape.
    """
    if not text or not isinstance(text, str) or len(text.strip()) < 5:
        return {"corrected_text": text or "", "has_corrections": False}

    corrected = _call_gemini(text)
    if corrected is not None:
        return {
            "corrected_text": corrected,
            "has_corrections": corrected.strip() != text.strip(),
        }

    # ── Fallback: simple dictionary corrections ─────────────────────────
    return _dictionary_fallback(text)


def apply_corrections(text, _accepted_corrections=None):
    """Legacy helper — kept for backward compatibility but no longer needed
    by the new Gemini-based flow (frontend sends the whole corrected text)."""
    return text


# ── Dictionary fallback ────────────────────────────────────────────────────

_TRAVEL_CORRECTIONS = {
    'accomodation': 'accommodation', 'accomodations': 'accommodations',
    'restaraunt': 'restaurant', 'restarant': 'restaurant', 'resturant': 'restaurant',
    'breakfest': 'breakfast', 'brekfast': 'breakfast',
    'recieve': 'receive', 'recieved': 'received',
    'excellant': 'excellent', 'excelent': 'excellent',
    'beautifull': 'beautiful', 'beatiful': 'beautiful',
    'confortable': 'comfortable', 'comfertable': 'comfortable',
    'convienent': 'convenient', 'conveniant': 'convenient',
    'definately': 'definitely', 'definitly': 'definitely',
    'dissapointed': 'disappointed', 'dissapointing': 'disappointing',
    'enviroment': 'environment', 'expirience': 'experience',
    'experiece': 'experience', 'fantanstic': 'fantastic',
    'freindly': 'friendly', 'frindly': 'friendly',
    'hospitalty': 'hospitality', 'hygeine': 'hygiene', 'hygene': 'hygiene',
    'luxary': 'luxury', 'maintanance': 'maintenance',
    'maintenence': 'maintenance', 'managment': 'management',
    'neccessary': 'necessary', 'occassion': 'occasion',
    'occurence': 'occurrence', 'pleasent': 'pleasant', 'plesant': 'pleasant',
    'proffesional': 'professional', 'profesional': 'professional',
    'recomend': 'recommend', 'reccomend': 'recommend',
    'terrable': 'terrible', 'terible': 'terrible',
    'wonderfull': 'wonderful', 'teh': 'the', 'thier': 'their',
    'wich': 'which', 'whith': 'with', 'untill': 'until',
    'prpely': 'properly', 'ths': 'this',
}


def _dictionary_fallback(text):
    """Apply dictionary-based corrections and return the same shape as the
    Gemini-based response."""
    result = text
    changed = False
    for match in re.finditer(r'\b([a-zA-Z]{2,})\b', text):
        word = match.group(1)
        replacement = _TRAVEL_CORRECTIONS.get(word.lower())
        if replacement:
            result = result[:match.start()] + replacement + result[match.end():]
            changed = True
    return {"corrected_text": result, "has_corrections": changed}
