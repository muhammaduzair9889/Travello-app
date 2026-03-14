# Travello ML System - Datasets Folder

## 📁 Add Your Datasets Here

Place your datasets in this folder:

### Required Datasets:

1. **hotels_pois.csv** - Hotels and Points of Interest
   - Columns: id, name, description, tags, category, city, lat, lon, price_pkr, rating, availability, images, owner_id
   - Example: Pearl Continental Hotel, Luxury 5-star hotel in Lahore, "luxury,wifi,pool,spa", hotel, Lahore, 31.5204, 74.3587, 35000, 9.2, true, "img1.jpg,img2.jpg", owner123

2. **user_events.csv** - User Interaction Data
   - Columns: event_id, user_id, item_id, event_type, timestamp, session_id, rating, duration_seconds
   - Event types: search, view, click, booking, rating
   - Example: evt001, user123, hotel001, booking, 2025-12-01 10:30:00, sess001, 5, 300

### Optional Datasets:

3. **user_profiles.csv** - User Demographics (optional)
   - Columns: user_id, age_group, location, preferences, join_date

4. **reviews.csv** - User Reviews (optional)
   - Columns: review_id, user_id, item_id, rating, text, timestamp

## 📊 Dataset Format Guidelines:

- **CSV format** with UTF-8 encoding
- **Headers** must be in the first row
- **Missing values**: Use empty string or "null"
- **Dates**: ISO format (YYYY-MM-DD HH:MM:SS)
- **Arrays**: Comma-separated strings (e.g., "tag1,tag2,tag3")
- **Coordinates**: Decimal degrees (lat: -90 to 90, lon: -180 to 180)

## 🔄 After Adding Datasets:

1. Place CSV files in this folder
2. Run preprocessing: `python ml_system/preprocessing/preprocess_data.py`
3. Generate embeddings: `python ml_system/embeddings/generate_embeddings.py`
4. Build index: `python ml_system/retrieval/build_index.py`
5. Train models: `python ml_system/training/train_recommender.py`

## 📝 Sample Data Generator:

If you don't have real data yet, run:
```bash
python ml_system/utils/generate_sample_data.py
```

This will create sample datasets for testing.

## ✅ Data Validation:

Before training, validate your data:
```bash
python ml_system/utils/validate_datasets.py
```

## 🔒 Security:

- **Do NOT commit real user data** to git
- Keep datasets in .gitignore
- Use anonymized/hashed user IDs
- Remove PII before training

---

**Current Status**: ✅ Folder created, ready for datasets!

Add your CSV files here and the ML pipeline will automatically process them.
