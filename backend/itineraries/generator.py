import math
import random
from datetime import timedelta

from django.db import transaction

from .models import Place, Itinerary


# ── Mapping from user-facing interest/mood strings to internal tags ──

INTEREST_TAGS = {
    'history': 'history',
    'culture': 'culture',
    'food': 'food',
    'shopping': 'shopping',
    'nature': 'nature',
    'religious sites': 'religious',
    'religious': 'religious',
    'modern attractions': 'modern',
    'modern': 'modern',
    # Mood tags
    'relaxing': 'relaxing',
    'spiritual': 'spiritual',
    'historical': 'historical',
    'foodie': 'foodie',
    'fun': 'fun',
    'entertainment': 'entertainment',
    'romantic': 'romantic',
    'family': 'family',
}

# Mood → matching tags (highest weight in scoring)
MOOD_TAG_MAP = {
    'RELAXING':    ['relaxing', 'nature'],
    'SPIRITUAL':   ['spiritual', 'religious'],
    'HISTORICAL':  ['historical', 'history', 'culture'],
    'FOODIE':      ['foodie', 'food'],
    'FUN':         ['fun', 'entertainment', 'modern'],
    'SHOPPING':    ['shopping', 'modern'],
    'NATURE':      ['nature', 'relaxing'],
    'ROMANTIC':    ['romantic', 'nature', 'food'],
    'FAMILY':      ['family', 'fun', 'nature'],
}


DEFAULT_LAHORE_PLACES = [
    # ==================== MUST SEE ATTRACTIONS (IDs 1-25, 96-120) ====================
    dict(name='Badshahi Mosque', category='Religious', tags=['religious', 'spiritual', 'history', 'historical', 'culture'], minutes=120, budget='LOW', lat=31.588056, lon=74.309444, rating=4.8, start=8, end=18),
    dict(name='Lahore Fort (Shahi Qila)', category='History', tags=['history', 'historical', 'culture'], minutes=150, budget='LOW', lat=31.588333, lon=74.315278, rating=4.7, start=9, end=17),
    dict(name='Minar-e-Pakistan', category='History', tags=['history', 'historical', 'culture'], minutes=75, budget='LOW', lat=31.5925, lon=74.309444, rating=4.6, start=9, end=21),
    dict(name='Lahore Museum', category='Culture', tags=['culture', 'history', 'historical'], minutes=120, budget='LOW', lat=31.5693, lon=74.3107, rating=4.5, start=9, end=17),
    dict(name='Shalimar Gardens', category='Nature', tags=['nature', 'relaxing', 'history', 'historical', 'culture', 'romantic'], minutes=120, budget='LOW', lat=31.585833, lon=74.381944, rating=4.6, start=9, end=18),
    dict(name='Wazir Khan Mosque', category='Religious', tags=['religious', 'spiritual', 'history', 'historical', 'culture'], minutes=90, budget='LOW', lat=31.581944, lon=74.321667, rating=4.7, start=8, end=18),
    dict(name='Data Darbar', category='Religious', tags=['religious', 'spiritual', 'culture'], minutes=90, budget='LOW', lat=31.5700, lon=74.3100, rating=4.5, start=6, end=22),
    dict(name='Jahangir\'s Tomb', category='History', tags=['history', 'historical', 'culture', 'relaxing'], minutes=90, budget='LOW', lat=31.620556, lon=74.276944, rating=4.4, start=9, end=17),
    dict(name='Tomb of Allama Iqbal', category='History', tags=['history', 'historical', 'culture', 'spiritual'], minutes=60, budget='LOW', lat=31.5883, lon=74.3100, rating=4.5, start=9, end=18),
    dict(name='Lahore Zoo', category='Nature', tags=['nature', 'family', 'fun'], minutes=120, budget='LOW', lat=31.5573, lon=74.3287, rating=4.1, start=9, end=17),
    dict(name='Chauburji', category='History', tags=['history', 'historical', 'culture'], minutes=60, budget='LOW', lat=31.5397, lon=74.3333, rating=4.2, start=9, end=17),
    dict(name='Hazuri Bagh', category='Nature', tags=['nature', 'history', 'historical', 'relaxing'], minutes=60, budget='LOW', lat=31.5879, lon=74.3107, rating=4.3, start=9, end=18),
    dict(name='Tomb of Nur Jahan', category='History', tags=['history', 'historical', 'romantic'], minutes=60, budget='LOW', lat=31.6210, lon=74.2785, rating=4.3, start=9, end=17),
    dict(name='Sheesh Mahal (Mirror Palace)', category='History', tags=['history', 'historical', 'culture'], minutes=75, budget='LOW', lat=31.5880, lon=74.3155, rating=4.6, start=9, end=17),
    dict(name='Samadhi of Ranjit Singh', category='History', tags=['history', 'historical', 'culture', 'spiritual'], minutes=60, budget='LOW', lat=31.5883, lon=74.3097, rating=4.4, start=9, end=17),
    dict(name='Delhi Gate (Old Lahore)', category='Culture', tags=['culture', 'history', 'historical', 'shopping'], minutes=90, budget='LOW', lat=31.5780, lon=74.3210, rating=4.3, start=10, end=22),
    dict(name='Roshnai Gate', category='History', tags=['history', 'historical', 'culture'], minutes=45, budget='LOW', lat=31.5870, lon=74.3113, rating=4.2, start=9, end=18),
    dict(name='Lahore High Court', category='Culture', tags=['culture', 'history', 'historical'], minutes=45, budget='LOW', lat=31.5580, lon=74.3217, rating=4.1, start=9, end=16),
    dict(name='Kim\'s Gun (Zamzama)', category='History', tags=['history', 'historical', 'culture'], minutes=30, budget='LOW', lat=31.5692, lon=74.3105, rating=4.0, start=9, end=18),
    dict(name='Fakir Khana Museum', category='Culture', tags=['culture', 'history', 'historical'], minutes=90, budget='LOW', lat=31.5768, lon=74.3152, rating=4.4, start=10, end=17),
    dict(name='Sunehri Masjid (Golden Mosque)', category='Religious', tags=['religious', 'spiritual', 'history', 'culture'], minutes=60, budget='LOW', lat=31.5788, lon=74.3175, rating=4.4, start=8, end=18),
    dict(name='Masjid Mariyam Zamani', category='Religious', tags=['religious', 'spiritual', 'history', 'historical'], minutes=45, budget='LOW', lat=31.5877, lon=74.3148, rating=4.3, start=8, end=18),
    dict(name='Moti Masjid (Pearl Mosque)', category='Religious', tags=['religious', 'spiritual', 'history', 'historical'], minutes=45, budget='LOW', lat=31.5880, lon=74.3152, rating=4.3, start=9, end=17),
    dict(name='Anarkali Tomb', category='History', tags=['history', 'historical', 'culture'], minutes=45, budget='LOW', lat=31.5567, lon=74.3200, rating=4.1, start=9, end=17),
    dict(name='General Post Office', category='Culture', tags=['culture', 'history', 'historical'], minutes=30, budget='LOW', lat=31.5603, lon=74.3163, rating=4.0, start=9, end=16),
    dict(name='Grand Jamia Mosque (Bahria Town)', category='Religious', tags=['religious', 'spiritual', 'modern'], minutes=120, budget='LOW', lat=31.3597, lon=74.1822, rating=4.7, start=8, end=20),
    dict(name='Gurdwara Dera Sahib', category='Religious', tags=['religious', 'spiritual', 'history', 'historical'], minutes=60, budget='LOW', lat=31.5880, lon=74.3094, rating=4.4, start=8, end=18),
    dict(name='Gurdwara Janam Asthan Guru Ram Das', category='Religious', tags=['religious', 'spiritual', 'history'], minutes=60, budget='LOW', lat=31.5798, lon=74.3183, rating=4.3, start=8, end=18),
    dict(name='Tomb of Asif Khan', category='History', tags=['history', 'historical'], minutes=60, budget='LOW', lat=31.6219, lon=74.2772, rating=4.2, start=9, end=17),
    dict(name='Shahi Hammam (Royal Bath)', category='Culture', tags=['culture', 'history', 'historical'], minutes=60, budget='LOW', lat=31.5819, lon=74.3217, rating=4.5, start=10, end=17),
    dict(name='Alamgiri Gate (Lahore Fort)', category='History', tags=['history', 'historical', 'culture'], minutes=45, budget='LOW', lat=31.5880, lon=74.3133, rating=4.4, start=9, end=17),
    dict(name='Naulakha Pavilion', category='History', tags=['history', 'historical', 'culture'], minutes=45, budget='LOW', lat=31.5881, lon=74.3150, rating=4.5, start=9, end=17),
    dict(name='Tomb of Dai Anga', category='History', tags=['history', 'historical'], minutes=45, budget='LOW', lat=31.5920, lon=74.3278, rating=4.1, start=9, end=17),
    dict(name='Bibi Pak Daman Shrine', category='Religious', tags=['religious', 'spiritual', 'history'], minutes=60, budget='LOW', lat=31.5480, lon=74.3367, rating=4.3, start=8, end=20),
    dict(name='Shrine of Mian Mir', category='Religious', tags=['religious', 'spiritual', 'history'], minutes=60, budget='LOW', lat=31.5422, lon=74.3522, rating=4.4, start=8, end=20),
    dict(name='Madho Lal Hussain Shrine', category='Religious', tags=['religious', 'spiritual', 'culture'], minutes=60, budget='LOW', lat=31.6050, lon=74.3650, rating=4.3, start=8, end=20),
    dict(name='Walled City of Lahore', category='Culture', tags=['culture', 'history', 'historical', 'food', 'foodie', 'shopping'], minutes=180, budget='LOW', lat=31.5820, lon=74.3175, rating=4.6, start=10, end=22),
    dict(name='Tomb of Qutb-ud-din Aibak', category='History', tags=['history', 'historical'], minutes=45, budget='LOW', lat=31.5625, lon=74.3097, rating=4.1, start=9, end=17),
    dict(name='Government College University', category='Culture', tags=['culture', 'history', 'historical'], minutes=60, budget='LOW', lat=31.5622, lon=74.3258, rating=4.3, start=9, end=16),
    dict(name='Punjab University Old Campus', category='Culture', tags=['culture', 'history', 'historical'], minutes=60, budget='LOW', lat=31.5573, lon=74.3247, rating=4.2, start=9, end=16),
    dict(name='Aitchison College', category='Culture', tags=['culture', 'history', 'historical'], minutes=60, budget='LOW', lat=31.5350, lon=74.3478, rating=4.3, start=9, end=16),
    dict(name='WAPDA House', category='Culture', tags=['culture', 'modern', 'history'], minutes=30, budget='LOW', lat=31.5597, lon=74.3178, rating=4.0, start=9, end=17),
    dict(name='Lohari Gate', category='History', tags=['history', 'historical', 'culture'], minutes=45, budget='LOW', lat=31.5772, lon=74.3142, rating=4.1, start=9, end=18),
    dict(name='Mochi Gate', category='History', tags=['history', 'historical', 'culture'], minutes=45, budget='LOW', lat=31.5848, lon=74.3185, rating=4.0, start=9, end=18),
    dict(name='Bhatti Gate', category='History', tags=['history', 'historical', 'culture', 'food'], minutes=60, budget='LOW', lat=31.5778, lon=74.3228, rating=4.1, start=10, end=22),
    dict(name='Akbari Gate', category='History', tags=['history', 'historical', 'culture', 'shopping'], minutes=45, budget='LOW', lat=31.5843, lon=74.3227, rating=4.0, start=9, end=18),
    dict(name='Taxali Gate', category='History', tags=['history', 'historical', 'culture'], minutes=45, budget='LOW', lat=31.5850, lon=74.3125, rating=4.0, start=9, end=18),
    dict(name='Lahore Railway Station', category='Culture', tags=['culture', 'history', 'historical'], minutes=45, budget='LOW', lat=31.5917, lon=74.3267, rating=4.2, start=6, end=22),
    dict(name='Islamic Summit Minar', category='History', tags=['history', 'historical', 'culture'], minutes=30, budget='LOW', lat=31.5950, lon=74.3092, rating=4.1, start=9, end=18),
    dict(name='Alhamra Arts Council', category='Culture', tags=['culture', 'modern', 'entertainment', 'fun'], minutes=120, budget='LOW', lat=31.5593, lon=74.3308, rating=4.4, start=10, end=22),

    # ==================== FOOD DESTINATIONS (IDs 26-65, 146-165) ====================
    dict(name='Food Street Gawalmandi', category='Food', tags=['food', 'foodie', 'culture', 'romantic'], minutes=120, budget='LOW', lat=31.571997, lon=74.318875, rating=4.4, start=18, end=23),
    dict(name='MM Alam Road', category='Food', tags=['food', 'foodie', 'modern', 'romantic'], minutes=120, budget='LUXURY', lat=31.521359, lon=74.351589, rating=4.5, start=12, end=23),
    dict(name='Lakshmi Chowk', category='Food', tags=['food', 'foodie', 'culture'], minutes=90, budget='LOW', lat=31.567310, lon=74.324761, rating=4.3, start=19, end=2),
    dict(name='Anarkali Food Street', category='Food', tags=['food', 'foodie', 'culture', 'shopping'], minutes=90, budget='LOW', lat=31.562481, lon=74.309333, rating=4.3, start=11, end=23),
    dict(name='Fort Road Food Street', category='Food', tags=['food', 'foodie', 'culture', 'romantic'], minutes=120, budget='MEDIUM', lat=31.587249, lon=74.311586, rating=4.5, start=18, end=23),
    dict(name='Butt Karahi (Lakshmi Chowk)', category='Food', tags=['food', 'foodie', 'culture'], minutes=90, budget='LOW', lat=31.5672, lon=74.3243, rating=4.5, start=18, end=23),
    dict(name='Cafe Aylanto', category='Food', tags=['food', 'foodie', 'modern', 'romantic'], minutes=90, budget='LUXURY', lat=31.5168757, lon=74.3518081, rating=4.5, start=12, end=23),
    dict(name='Cooco\'s Den', category='Food', tags=['food', 'foodie', 'culture', 'romantic'], minutes=90, budget='MEDIUM', lat=31.5870545, lon=74.3115511, rating=4.6, start=18, end=23),
    dict(name='Bundu Khan (MM Alam)', category='Food', tags=['food', 'foodie', 'culture'], minutes=90, budget='MEDIUM', lat=31.5213, lon=74.3512, rating=4.4, start=12, end=23),
    dict(name='Haveli Restaurant', category='Food', tags=['food', 'foodie', 'culture', 'romantic'], minutes=90, budget='MEDIUM', lat=31.5870129, lon=74.3114255, rating=4.5, start=18, end=23),
    dict(name='Andaaz Restaurant', category='Food', tags=['food', 'foodie', 'culture', 'romantic'], minutes=90, budget='MEDIUM', lat=31.5871, lon=74.3112, rating=4.4, start=18, end=23),
    dict(name='Salt\'n Pepper Village', category='Food', tags=['food', 'foodie', 'family'], minutes=90, budget='MEDIUM', lat=31.4683, lon=74.2648, rating=4.3, start=12, end=23),
    dict(name='Monal Lahore', category='Food', tags=['food', 'foodie', 'modern', 'romantic'], minutes=120, budget='LUXURY', lat=31.5097528, lon=74.3410388, rating=4.5, start=12, end=23),
    dict(name='Phajja Siri Paye', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.5852863, lon=74.3125410, rating=4.4, start=6, end=14),
    dict(name='Bashir Dar-ul-Mahi', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.5118, lon=74.3453, rating=4.4, start=12, end=22),
    dict(name='Peeru\'s Cafe', category='Food', tags=['food', 'foodie', 'culture', 'relaxing'], minutes=90, budget='MEDIUM', lat=31.4122864, lon=74.2327037, rating=4.3, start=11, end=22),
    dict(name='Cosa Nostra', category='Food', tags=['food', 'foodie', 'modern', 'romantic'], minutes=90, budget='MEDIUM', lat=31.4609448, lon=74.4136984, rating=4.4, start=12, end=23),
    dict(name='Nafees Bakers', category='Food', tags=['food', 'foodie', 'culture'], minutes=45, budget='LOW', lat=31.5117, lon=74.3445, rating=4.2, start=8, end=22),
    dict(name='Waris Nihari (Walled City)', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.5824, lon=74.3205, rating=4.5, start=6, end=14),
    dict(name='Yummy 36 Paye', category='Food', tags=['food', 'foodie'], minutes=60, budget='LOW', lat=31.5783, lon=74.3142, rating=4.2, start=19, end=2),
    dict(name='Heera Mandi Food Area', category='Food', tags=['food', 'foodie', 'culture'], minutes=90, budget='LOW', lat=31.5865, lon=74.3120, rating=4.3, start=18, end=23),
    dict(name='Muhammadi Nihari', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.5623, lon=74.3095, rating=4.3, start=6, end=14),
    dict(name='Tayeb Kabab House', category='Food', tags=['food', 'foodie'], minutes=60, budget='LOW', lat=31.5671, lon=74.3239, rating=4.2, start=12, end=23),
    dict(name='Cuckoo\'s Cafe (Liberty)', category='Food', tags=['food', 'foodie', 'modern'], minutes=90, budget='MEDIUM', lat=31.5113, lon=74.3447, rating=4.3, start=11, end=23),
    dict(name='Nishat Hotel (Cinema Chowk)', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.5625, lon=74.3128, rating=4.2, start=6, end=14),
    dict(name='Khalifa Bakers', category='Food', tags=['food', 'foodie', 'culture'], minutes=45, budget='LOW', lat=31.5641, lon=74.3133, rating=4.3, start=8, end=22),
    dict(name='Haji Sahab Haleem Wala', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.5624, lon=74.3097, rating=4.4, start=12, end=22),
    dict(name='Sadiq Halwa Puri', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.5201583, lon=74.2911526, rating=4.3, start=6, end=12),
    dict(name='Arcadian Cafe', category='Food', tags=['food', 'foodie', 'modern'], minutes=90, budget='MEDIUM', lat=31.5226637, lon=74.3495417, rating=4.2, start=10, end=23),
    dict(name='Mughalia Restaurant', category='Food', tags=['food', 'foodie', 'culture', 'romantic'], minutes=90, budget='MEDIUM', lat=31.5872, lon=74.3110, rating=4.3, start=12, end=23),
    dict(name='Cafe Zouk', category='Food', tags=['food', 'foodie', 'modern'], minutes=90, budget='MEDIUM', lat=31.5203649, lon=74.3516633, rating=4.3, start=10, end=23),
    dict(name='X2 (MM Alam)', category='Food', tags=['food', 'foodie', 'modern', 'fun', 'entertainment'], minutes=120, budget='MEDIUM', lat=31.5205, lon=74.3508, rating=4.2, start=18, end=23),
    dict(name='Howdy Cafe', category='Food', tags=['food', 'foodie', 'modern'], minutes=60, budget='MEDIUM', lat=31.5168, lon=74.3478, rating=4.1, start=11, end=23),
    dict(name='Gun Smoke (DHA)', category='Food', tags=['food', 'foodie', 'modern'], minutes=90, budget='MEDIUM', lat=31.4785, lon=74.4082, rating=4.2, start=12, end=23),
    dict(name='Zakir Tikka (Model Town)', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.4750243, lon=74.3053249, rating=4.4, start=18, end=23),
    dict(name='Faisal Broast', category='Food', tags=['food', 'foodie'], minutes=45, budget='LOW', lat=31.5082751, lon=74.3232818, rating=4.1, start=12, end=23),
    dict(name='Malik Nihari', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.5537450, lon=74.3141492, rating=4.2, start=6, end=14),
    dict(name='Sheikh Abdul Ghani Paratha', category='Food', tags=['food', 'foodie', 'culture'], minutes=60, budget='LOW', lat=31.5672, lon=74.3245, rating=4.5, start=18, end=23),
    dict(name='Monal (Liberty)', category='Food', tags=['food', 'foodie', 'modern'], minutes=90, budget='LUXURY', lat=31.5115, lon=74.3445, rating=4.4, start=12, end=23),
    dict(name='Ambala Sweets', category='Food', tags=['food', 'foodie', 'culture'], minutes=30, budget='LOW', lat=31.5540, lon=74.3142, rating=4.2, start=9, end=22),
    dict(name='Gourmet Restaurant', category='Food', tags=['food', 'foodie'], minutes=60, budget='LOW', lat=31.5118, lon=74.3447, rating=4.1, start=8, end=23),
    dict(name='BBQ Tonight', category='Food', tags=['food', 'foodie', 'modern'], minutes=90, budget='MEDIUM', lat=31.5212, lon=74.3508, rating=4.3, start=18, end=23),
    dict(name='English Tea House', category='Food', tags=['food', 'foodie', 'modern', 'romantic', 'relaxing'], minutes=90, budget='MEDIUM', lat=31.5205, lon=74.3512, rating=4.3, start=10, end=22),
    dict(name='Dera Restaurant', category='Food', tags=['food', 'foodie', 'culture', 'family'], minutes=90, budget='MEDIUM', lat=31.4695, lon=74.4020, rating=4.3, start=12, end=23),
    dict(name='Fujiyama (MM Alam)', category='Food', tags=['food', 'foodie', 'modern'], minutes=90, budget='LUXURY', lat=31.5210, lon=74.3514, rating=4.2, start=12, end=23),
    dict(name='Shaheen Shinwari', category='Food', tags=['food', 'foodie', 'culture'], minutes=90, budget='LOW', lat=31.5420, lon=74.3120, rating=4.3, start=12, end=23),

    # ==================== SHOPPING AREAS (IDs 66-80, 121-128) ====================
    dict(name='Liberty Market', category='Shopping', tags=['shopping', 'modern', 'food', 'foodie'], minutes=120, budget='MEDIUM', lat=31.511280, lon=74.345008, rating=4.4, start=12, end=23),
    dict(name='Anarkali Bazaar', category='Shopping', tags=['shopping', 'culture', 'food', 'foodie'], minutes=120, budget='LOW', lat=31.562481, lon=74.309333, rating=4.4, start=11, end=22),
    dict(name='Packages Mall', category='Shopping', tags=['shopping', 'modern', 'food', 'family', 'fun', 'entertainment'], minutes=150, budget='MEDIUM', lat=31.4711831, lon=74.3560264, rating=4.6, start=12, end=23),
    dict(name='Emporium Mall', category='Shopping', tags=['shopping', 'modern', 'food', 'family', 'fun', 'entertainment'], minutes=150, budget='MEDIUM', lat=31.4671890, lon=74.2659803, rating=4.6, start=12, end=23),
    dict(name='Fortress Stadium', category='Shopping', tags=['shopping', 'modern', 'fun'], minutes=120, budget='MEDIUM', lat=31.5317842, lon=74.3660636, rating=4.3, start=12, end=23),
    dict(name='Pace Shopping Mall', category='Shopping', tags=['shopping', 'modern'], minutes=120, budget='MEDIUM', lat=31.5158879, lon=74.3520254, rating=4.2, start=12, end=22),
    dict(name='Gulberg Main Market', category='Shopping', tags=['shopping', 'modern', 'food'], minutes=90, budget='MEDIUM', lat=31.53055, lon=74.36112, rating=4.2, start=11, end=22),
    dict(name='Mall Road', category='Shopping', tags=['shopping', 'culture', 'history'], minutes=120, budget='MEDIUM', lat=31.5555364, lon=74.3321938, rating=4.3, start=10, end=22),
    dict(name='Ichra Bazaar', category='Shopping', tags=['shopping', 'culture'], minutes=90, budget='LOW', lat=31.5329591, lon=74.3183969, rating=4.1, start=10, end=22),
    dict(name='Shah Alam Market', category='Shopping', tags=['shopping', 'culture'], minutes=90, budget='LOW', lat=31.5778376, lon=74.3178981, rating=4.1, start=10, end=20),
    dict(name='Azam Cloth Market', category='Shopping', tags=['shopping', 'culture'], minutes=90, budget='LOW', lat=31.5840475, lon=74.3208779, rating=4.1, start=10, end=20),
    dict(name='Urdu Bazaar', category='Shopping', tags=['shopping', 'culture', 'history'], minutes=90, budget='LOW', lat=31.5749997, lon=74.3096226, rating=4.2, start=10, end=20),
    dict(name='Hall Road Electronics', category='Shopping', tags=['shopping', 'modern'], minutes=90, budget='MEDIUM', lat=31.5640804, lon=74.3187403, rating=4.0, start=10, end=20),
    dict(name='Hafeez Centre', category='Shopping', tags=['shopping', 'modern'], minutes=90, budget='MEDIUM', lat=31.5160698, lon=74.3429861, rating=4.1, start=10, end=22),
    dict(name='DHA Y Block Market', category='Shopping', tags=['shopping', 'modern', 'food'], minutes=90, budget='LUXURY', lat=31.4673316, lon=74.4333092, rating=4.3, start=11, end=23),
    dict(name='Dolmen Mall', category='Shopping', tags=['shopping', 'modern', 'food', 'entertainment'], minutes=150, budget='MEDIUM', lat=31.5052, lon=74.3388, rating=4.3, start=12, end=23),
    dict(name='Akbari Mandi', category='Shopping', tags=['shopping', 'culture', 'food'], minutes=60, budget='LOW', lat=31.5843, lon=74.3227, rating=4.0, start=8, end=18),
    dict(name='Brandreth Road Market', category='Shopping', tags=['shopping', 'culture'], minutes=60, budget='LOW', lat=31.5715, lon=74.3187, rating=3.9, start=10, end=18),
    dict(name='Tollinton Market', category='Shopping', tags=['shopping', 'culture', 'history'], minutes=60, budget='LOW', lat=31.5580, lon=74.3250, rating=4.1, start=10, end=18),
    dict(name='Lahore Expo Centre', category='Shopping', tags=['shopping', 'modern'], minutes=120, budget='MEDIUM', lat=31.4653, lon=74.3642, rating=4.2, start=10, end=20),

    # ==================== ADVENTURE & PARKS (IDs 81-95, 129-145) ====================
    dict(name='Jilani Park (Racecourse)', category='Nature', tags=['nature', 'relaxing', 'romantic', 'family'], minutes=90, budget='LOW', lat=31.5095, lon=74.3360, rating=4.5, start=7, end=21),
    dict(name='Jallo Park', category='Nature', tags=['nature', 'family', 'fun', 'relaxing'], minutes=150, budget='LOW', lat=31.5717696, lon=74.4745342, rating=4.3, start=9, end=18),
    dict(name='Greater Iqbal Park', category='Nature', tags=['nature', 'relaxing', 'romantic', 'family', 'fun'], minutes=90, budget='LOW', lat=31.5924791, lon=74.3094765, rating=4.6, start=7, end=22),
    dict(name='Bagh-e-Jinnah (Lawrence Gardens)', category='Nature', tags=['nature', 'relaxing', 'romantic', 'family'], minutes=90, budget='LOW', lat=31.5523964, lon=74.3288503, rating=4.5, start=7, end=20),
    dict(name='Sozo Water Park', category='Modern', tags=['fun', 'entertainment', 'family'], minutes=240, budget='MEDIUM', lat=31.5813007, lon=74.4868904, rating=4.2, start=10, end=18),
    dict(name='Joyland', category='Modern', tags=['fun', 'entertainment', 'family'], minutes=180, budget='LOW', lat=31.5323582, lon=74.3631271, rating=4.0, start=16, end=23),
    dict(name='Model Town Park', category='Nature', tags=['nature', 'relaxing', 'family'], minutes=60, budget='LOW', lat=31.4846361, lon=74.3262319, rating=4.2, start=7, end=21),
    dict(name='Gaddafi Stadium', category='Modern', tags=['modern', 'fun', 'entertainment'], minutes=120, budget='LOW', lat=31.5133615, lon=74.3334644, rating=4.4, start=10, end=18),
    dict(name='National Hockey Stadium', category='Modern', tags=['modern', 'fun', 'entertainment'], minutes=90, budget='LOW', lat=31.5111075, lon=74.3351685, rating=4.2, start=10, end=18),
    dict(name='Lahore Gymkhana', category='Modern', tags=['modern', 'relaxing', 'fun'], minutes=120, budget='LUXURY', lat=31.5351392, lon=74.3546905, rating=4.3, start=8, end=20),
    dict(name='Safari Park (Wildlife Park)', category='Nature', tags=['nature', 'family', 'fun', 'entertainment'], minutes=180, budget='LOW', lat=31.5746415, lon=74.4754935, rating=4.1, start=9, end=18),
    dict(name='Lahore Golf Club', category='Modern', tags=['modern', 'relaxing', 'fun'], minutes=180, budget='LUXURY', lat=31.4689395, lon=74.4715513, rating=4.3, start=7, end=18),
    dict(name='Royal Palm Golf & Country Club', category='Modern', tags=['modern', 'relaxing', 'fun', 'romantic'], minutes=180, budget='LUXURY', lat=31.4665, lon=74.4245, rating=4.4, start=7, end=18),
    dict(name='Gulshan-e-Iqbal Park', category='Nature', tags=['nature', 'relaxing', 'family'], minutes=60, budget='LOW', lat=31.5139069, lon=74.2890468, rating=4.2, start=7, end=21),
    dict(name='Askari Park', category='Nature', tags=['nature', 'family', 'fun'], minutes=90, budget='LOW', lat=31.4653340, lon=74.3801628, rating=4.1, start=7, end=21),
    dict(name='Lahore Canal', category='Nature', tags=['nature', 'relaxing', 'romantic'], minutes=60, budget='LOW', lat=31.5350, lon=74.3150, rating=4.1, start=6, end=21),
    dict(name='Changa Manga Forest', category='Nature', tags=['nature', 'relaxing', 'family', 'fun'], minutes=300, budget='LOW', lat=31.0800, lon=73.9700, rating=4.3, start=9, end=17),
    dict(name='Wagah Border', category='Modern', tags=['modern', 'fun', 'entertainment', 'culture'], minutes=150, budget='LOW', lat=31.6047, lon=74.5728, rating=4.7, start=15, end=19),
    dict(name='Oasis Golf & Aqua Resort', category='Modern', tags=['modern', 'fun', 'entertainment', 'family', 'relaxing'], minutes=240, budget='LUXURY', lat=31.4050, lon=74.2100, rating=4.2, start=9, end=18),
    dict(name='Nasir Bagh', category='Nature', tags=['nature', 'relaxing'], minutes=60, budget='LOW', lat=31.5905, lon=74.3100, rating=4.0, start=7, end=20),
    dict(name='Shahdara Bagh', category='Nature', tags=['nature', 'history', 'historical', 'relaxing'], minutes=120, budget='LOW', lat=31.6200, lon=74.2780, rating=4.2, start=9, end=17),
    dict(name='Arfa Software Technology Park', category='Modern', tags=['modern'], minutes=60, budget='LOW', lat=31.4750, lon=74.2683, rating=4.0, start=9, end=17),
]


def ensure_lahore_places_seeded():
    """Seed default Lahore places. Updates count if new places were added."""
    existing_count = Place.objects.filter(city='Lahore').count()
    if existing_count >= len(DEFAULT_LAHORE_PLACES):
        return
    objs = []
    for p in DEFAULT_LAHORE_PLACES:
        objs.append(
            Place(
                city='Lahore',
                name=p['name'],
                category=p['category'],
                tags=p['tags'],
                estimated_visit_minutes=p['minutes'],
                budget_level=p['budget'],
                latitude=p['lat'],
                longitude=p['lon'],
                average_rating=p['rating'],
                ideal_start_hour=p['start'],
                ideal_end_hour=p['end'],
            )
        )
    Place.objects.bulk_create(objs, ignore_conflicts=True)


def _budget_rank(level: str) -> int:
    return {'LOW': 1, 'MEDIUM': 2, 'LUXURY': 3}.get(level or 'MEDIUM', 2)


def haversine_km(a_lat, a_lon, b_lat, b_lon):
    r = 6371.0
    p1 = math.radians(a_lat)
    p2 = math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lon - a_lon)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(x)))


def _pace_target(pace: str) -> int:
    if pace == Itinerary.Pace.RELAXED:
        return 3
    if pace == Itinerary.Pace.PACKED:
        return 7
    return 5  # balanced


def _normalize_interests(interests):
    out = []
    for i in interests or []:
        key = str(i).strip().lower()
        tag = INTEREST_TAGS.get(key, key)
        if tag and tag not in out:
            out.append(tag)
    return out


def _get_mood_tags(mood: str) -> list:
    """Get the tag list for a given mood."""
    return MOOD_TAG_MAP.get(mood.upper() if mood else '', [])


def _score_place(place: Place, interests_tags, mood_tags=None, popularity_weight=0.5):
    """
    Score a place based on:
      1. Mood match (highest weight — 15 pts per tag match)
      2. Interest match (10 pts per tag match)
      3. Budget compatibility (implicit — already filtered)
      4. Popularity score (stored as rating * 10)
      5. Base rating
    """
    tags = set([t.lower() for t in (place.tags or [])])
    score = 0.0

    # Mood match — highest weight
    if mood_tags:
        mood_overlap = len(tags.intersection(set(mood_tags)))
        score += mood_overlap * 15

    # Interest match
    if interests_tags:
        interest_overlap = len(tags.intersection(set(interests_tags)))
        score += interest_overlap * 10

    # Popularity bonus
    score += (place.average_rating or 0) * popularity_weight

    return score


def _pick_nearby(seed_place: Place, candidates, k):
    """Pick the k nearest candidates to seed_place by distance."""
    scored = []
    for p in candidates:
        d = haversine_km(seed_place.latitude, seed_place.longitude, p.latitude, p.longitude)
        scored.append((d, p))
    scored.sort(key=lambda x: x[0])
    return [p for _, p in scored[:k]]


def _build_day_items(day_places, per_day):
    """Convert a list of Place objects into day item dicts with time slots."""
    items = []
    for idx, p in enumerate(day_places):
        slot = 'morning' if idx == 0 else ('afternoon' if idx < max(2, per_day - 1) else 'evening')
        items.append({
            'type': 'place',
            'slot': slot,
            'place_id': p.id,
            'name': p.name,
            'category': p.category,
            'estimated_visit_minutes': p.estimated_visit_minutes,
            'budget_level': p.budget_level,
            'latitude': p.latitude,
            'longitude': p.longitude,
            'average_rating': p.average_rating,
            'tags': p.tags or [],
            'ideal_hours': {'start': p.ideal_start_hour, 'end': p.ideal_end_hour},
        })
    return items


def generate_itinerary(*, user, city: str, start_date, end_date, travelers: int,
                       budget_level: str, interests, pace: str, mood: str = '',
                       excluded_ids=None, locked_ids=None):
    """
    Generate an AI-powered itinerary.
    
    Args:
        excluded_ids: Place IDs to exclude (from previous regenerations)
        locked_ids: Place IDs that must be kept (user-locked)
    """
    ensure_lahore_places_seeded()

    interests_tags = _normalize_interests(interests)
    mood_tags = _get_mood_tags(mood)
    
    # Combine mood tags with interests for comprehensive matching
    combined_tags = list(set(interests_tags + mood_tags))
    
    budget_cap = _budget_rank(budget_level)
    excluded_ids = set(excluded_ids or [])
    locked_ids = set(locked_ids or [])

    # Get all eligible places
    all_places = list(Place.objects.filter(city=city))
    places = [p for p in all_places if _budget_rank(p.budget_level) <= budget_cap and p.id not in excluded_ids]

    # Score and rank — mood gets highest weight
    places.sort(key=lambda p: _score_place(p, interests_tags, mood_tags), reverse=True)

    # Add small random jitter to prevent identical regenerations
    if excluded_ids:
        random.shuffle(places)
        places.sort(key=lambda p: _score_place(p, interests_tags, mood_tags) + random.uniform(0, 3), reverse=True)

    days_count = max(1, (end_date - start_date).days)
    per_day = _pace_target(pace)
    used_ids = set()

    days = []
    current_date = start_date
    for day_idx in range(days_count):
        day_places = []

        # 1. Seed: choose best not-yet-used "major" place
        major = None
        for p in places:
            if p.id in used_ids:
                continue
            if p.estimated_visit_minutes >= 120 or p.category in ('History', 'Religious', 'Culture'):
                major = p
                break

        if major:
            used_ids.add(major.id)
            day_places.append(major)

            # 2. Fill nearby mid-attractions (distance optimization)
            remaining = [p for p in places if p.id not in used_ids]
            nearby = _pick_nearby(major, remaining, k=max(0, per_day - 1))
            for p in nearby:
                used_ids.add(p.id)
                day_places.append(p)

        # 3. If still not enough, top-rank fill
        if len(day_places) < per_day:
            for p in places:
                if p.id in used_ids:
                    continue
                used_ids.add(p.id)
                day_places.append(p)
                if len(day_places) >= per_day:
                    break

        # 3b. For longer trips — allow reusing places from earlier days
        #     with a preference for different categories than already in this day
        if len(day_places) < per_day:
            current_cats = {p.category for p in day_places}
            reusable = [p for p in places if p.id in used_ids and p.id not in {dp.id for dp in day_places}]
            # Prefer places whose category isn't already in today
            reusable.sort(key=lambda p: (p.category in current_cats, -_score_place(p, interests_tags, mood_tags)))
            for p in reusable:
                day_places.append(p)
                if len(day_places) >= per_day:
                    break

        # 4. Ensure evening food/shopping spot if mood or interests call for it
        wants_evening = any(t in combined_tags for t in ('food', 'foodie', 'shopping', 'romantic'))
        if wants_evening:
            has_evening = any(p.category in ('Food', 'Shopping') for p in day_places)
            if not has_evening:
                for p in places:
                    if p.id in used_ids:
                        continue
                    if p.category in ('Food', 'Shopping'):
                        used_ids.add(p.id)
                        if day_places:
                            day_places[-1] = p  # replace last slot
                        else:
                            day_places.append(p)
                        break

        items = _build_day_items(day_places, per_day)

        days.append({
            'date': current_date.isoformat(),
            'title': f"Day {day_idx + 1} - {city}",
            'items': items,
        })
        current_date = current_date + timedelta(days=1)

    with transaction.atomic():
        itinerary = Itinerary.objects.create(
            user=user,
            city=city,
            start_date=start_date,
            end_date=end_date,
            travelers=max(1, int(travelers or 1)),
            budget_level=budget_level,
            interests=interests_tags,
            pace=pace,
            mood=mood or '',
            days=days,
            locked_place_ids=list(locked_ids),
            excluded_place_ids=list(excluded_ids),
            saved=True,
        )

    return itinerary


def regenerate_day(itinerary: Itinerary, day_index: int):
    """
    Smart regeneration for a single day.
    - Preserves locked places
    - Excludes previously used high-ranked places
    - Maintains same mood, budget, pace
    - Ensures diversity (won't repeat identical plan)
    """
    ensure_lahore_places_seeded()

    interests_tags = _normalize_interests(itinerary.interests)
    mood_tags = _get_mood_tags(itinerary.mood)
    budget_cap = _budget_rank(itinerary.budget_level)
    per_day = _pace_target(itinerary.pace)

    # Collect IDs used in other days (don't reuse)
    used_ids = set()
    for di, day in enumerate(itinerary.days or []):
        if di == day_index:
            continue
        for item in day.get('items', []):
            if item.get('type') == 'place' and item.get('place_id'):
                used_ids.add(item['place_id'])

    # Collect current day's IDs to add to exclusion history
    current_day = itinerary.days[day_index] if day_index < len(itinerary.days) else {}
    current_ids = set()
    for item in current_day.get('items', []):
        if item.get('type') == 'place' and item.get('place_id'):
            current_ids.add(item['place_id'])

    # Global excluded IDs (history) — add current day's places
    excluded = set(itinerary.excluded_place_ids or [])
    excluded.update(current_ids)

    # Locked places must stay
    locked_ids = set(itinerary.locked_place_ids or [])
    
    # Build locked items (keep these in the day)
    locked_items = []
    for item in current_day.get('items', []):
        pid = item.get('place_id')
        if pid and pid in locked_ids:
            locked_items.append(item)

    # Get candidates
    candidates = list(Place.objects.filter(city=itinerary.city))
    candidates = [
        p for p in candidates
        if _budget_rank(p.budget_level) <= budget_cap
        and p.id not in used_ids
        and p.id not in locked_ids  # already handled
    ]
    
    # Penalize excluded places heavily but don't remove entirely
    def score_with_penalty(p):
        base = _score_place(p, interests_tags, mood_tags)
        if p.id in excluded:
            base -= 20  # Heavy penalty
        return base + random.uniform(0, 5)  # Randomize for diversity

    candidates.sort(key=score_with_penalty, reverse=True)

    # Pick new places
    slots_needed = per_day - len(locked_items)
    major = None
    picked = []
    
    for p in candidates:
        if p.estimated_visit_minutes >= 120 or p.category in ('History', 'Religious', 'Culture'):
            major = p
            break

    if major and slots_needed > 0:
        picked.append(major)
        rest = [p for p in candidates if p.id != major.id]
        picked.extend(_pick_nearby(major, rest, k=max(0, slots_needed - 1)))
    
    while len(picked) < slots_needed:
        for p in candidates:
            if p in picked:
                continue
            picked.append(p)
            break
        else:
            break

    # Build items: locked first, then new picks
    all_places = []
    locked_place_objects = {p.id: p for p in Place.objects.filter(id__in=locked_ids, city=itinerary.city)}
    for item in locked_items:
        pid = item.get('place_id')
        if pid in locked_place_objects:
            all_places.append(locked_place_objects[pid])
    all_places.extend(picked[:slots_needed])

    items = _build_day_items(all_places[:per_day], per_day)

    return items, list(excluded)


def regenerate_full_trip(itinerary: Itinerary):
    """
    Smart regeneration for the entire trip.
    - Uses alternative scoring paths for diversity
    - Preserves locked places
    - Excludes previously shown places
    - Ensures a completely different plan
    """
    ensure_lahore_places_seeded()

    interests_tags = _normalize_interests(itinerary.interests)
    mood_tags = _get_mood_tags(itinerary.mood)
    budget_cap = _budget_rank(itinerary.budget_level)
    per_day = _pace_target(itinerary.pace)
    locked_ids = set(itinerary.locked_place_ids or [])

    # Collect all previously used place IDs
    prev_ids = set(itinerary.excluded_place_ids or [])
    for day in itinerary.days or []:
        for item in day.get('items', []):
            pid = item.get('place_id')
            if pid and pid not in locked_ids:
                prev_ids.add(pid)

    places = list(Place.objects.filter(city=itinerary.city))
    places = [p for p in places if _budget_rank(p.budget_level) <= budget_cap]

    # Heavy penalty for previously used (but not impossible)
    def diversity_score(p):
        base = _score_place(p, interests_tags, mood_tags)
        if p.id in prev_ids:
            base -= 25
        if p.id in locked_ids:
            base += 50  # Boost locked places
        return base + random.uniform(0, 8)  # Extra randomization for diversity

    places.sort(key=diversity_score, reverse=True)

    days_count = max(1, (itinerary.end_date - itinerary.start_date).days)
    used_ids = set()
    days = []
    current_date = itinerary.start_date

    for day_idx in range(days_count):
        day_places = []

        # Keep locked places that were in this day
        if day_idx < len(itinerary.days or []):
            old_day = itinerary.days[day_idx]
            for item in old_day.get('items', []):
                pid = item.get('place_id')
                if pid and pid in locked_ids:
                    place_obj = next((p for p in places if p.id == pid), None)
                    if place_obj:
                        day_places.append(place_obj)
                        used_ids.add(pid)

        # Fill remaining slots
        remaining_slots = per_day - len(day_places)
        
        # Find major attraction
        major = None
        if remaining_slots > 0:
            for p in places:
                if p.id in used_ids:
                    continue
                if p.estimated_visit_minutes >= 120 or p.category in ('History', 'Religious', 'Culture'):
                    major = p
                    break
            
            if major:
                used_ids.add(major.id)
                day_places.append(major)
                remaining_slots -= 1
                
                rest = [p for p in places if p.id not in used_ids]
                nearby = _pick_nearby(major, rest, k=remaining_slots)
                for p in nearby:
                    used_ids.add(p.id)
                    day_places.append(p)

        # Top-up if needed
        while len(day_places) < per_day:
            filled = False
            for p in places:
                if p.id in used_ids:
                    continue
                used_ids.add(p.id)
                day_places.append(p)
                filled = True
                break
            if not filled:
                break

        # Reuse places from earlier days for longer trips
        if len(day_places) < per_day:
            current_cats = {p.category for p in day_places}
            reusable = [p for p in places if p.id in used_ids and p.id not in {dp.id for dp in day_places}]
            reusable.sort(key=lambda pp: (pp.category in current_cats, -_score_place(pp, interests_tags, mood_tags)))
            for p in reusable:
                day_places.append(p)
                if len(day_places) >= per_day:
                    break

        items = _build_day_items(day_places, per_day)

        days.append({
            'date': current_date.isoformat(),
            'title': f"Day {day_idx + 1} - {itinerary.city}",
            'items': items,
        })
        current_date += timedelta(days=1)

    return days, list(prev_ids)
