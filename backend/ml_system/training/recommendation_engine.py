"""
Recommendation Engine using Scikit-learn Cosine Similarity
Filters by availability, city, price range (PKR), and re-ranks results
"""

import pandas as pd
import numpy as np
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Try to import ML dependencies, but make them optional
try:
    import torch
    from transformers import AutoTokenizer, AutoModel
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.preprocessing import normalize
    ML_DEPENDENCIES_AVAILABLE = True
except Exception as e:
    logging.warning(f"ML dependencies not available: {e}")
    ML_DEPENDENCIES_AVAILABLE = False
    torch = None
    AutoTokenizer = None
    AutoModel = None
    cosine_similarity = None
    normalize = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RecommendationEngine:
    """
    ML-powered recommendation engine using:
    - DistilBERT/RoBERTa embeddings
    - Scikit-learn cosine similarity
    - Pandas for filtering and ranking
    """
    
    def __init__(self):
        """Load trained model and embeddings"""
        if not ML_DEPENDENCIES_AVAILABLE:
            logger.warning("ML dependencies not available. ML features will be disabled.")
            self.model = None
            self.tokenizer = None
            return
            
        self.backend_dir = Path(__file__).parent.parent.parent
        self.models_dir = self.backend_dir / "ml_system" / "models"
        
        # Load config
        config_file = self.models_dir / "travello_config.json"
        if not config_file.exists():
            logger.warning(
                f"Model not trained! Run: python ml_system/training/train_ml_model.py"
            )
            self.model = None
            self.tokenizer = None
            return
        
        with open(config_file, 'r') as f:
            self.config = json.load(f)
        
        logger.info(f"Loading model: {self.config['model_name']}")
        
        # Load tokenizer and model
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.tokenizer = AutoTokenizer.from_pretrained(self.config['model_name'])
        self.model = AutoModel.from_pretrained(self.config['model_name']).to(self.device)
        self.model.eval()
        
        # Load embeddings
        embeddings_file = self.models_dir / "travello_embeddings.npy"
        self.embeddings = np.load(embeddings_file)
        
        # Normalize embeddings for cosine similarity
        self.embeddings_normalized = normalize(self.embeddings, axis=1)
        
        # Load metadata
        metadata_file = self.models_dir / "travello_metadata.csv"
        self.metadata = pd.read_csv(metadata_file)
        
        logger.info(f"✓ Loaded model with {len(self.metadata)} items")
        logger.info(f"  - Hotels: {len(self.metadata[self.metadata['type']=='hotel'])}")
        logger.info(f"  - Attractions: {len(self.metadata[self.metadata['type']=='attraction'])}")
    
    def encode_query(self, query: str) -> np.ndarray:
        """
        Encode user query using DistilBERT/RoBERTa
        
        Args:
            query: User search query
        
        Returns:
            Query embedding vector
        """
        inputs = self.tokenizer(
            query,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors='pt'
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            # Use [CLS] token embedding
            query_embedding = outputs.last_hidden_state[:, 0, :].cpu().numpy()
        
        # Normalize for cosine similarity
        query_embedding = normalize(query_embedding, axis=1)
        
        return query_embedding[0]
    
    def compute_similarity(self, query_embedding: np.ndarray) -> np.ndarray:
        """
        Compute cosine similarity using scikit-learn
        
        Args:
            query_embedding: Query vector
        
        Returns:
            Similarity scores for all items
        """
        # Reshape query for sklearn
        query_embedding = query_embedding.reshape(1, -1)
        
        # Compute cosine similarity with all items
        similarities = cosine_similarity(query_embedding, self.embeddings_normalized)[0]
        
        return similarities
    
    def apply_filters(
        self,
        df: pd.DataFrame,
        city: Optional[str] = None,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        item_type: Optional[str] = None,
        availability: bool = True
    ) -> pd.DataFrame:
        """
        Apply filters to results using Pandas
        
        Args:
            df: DataFrame to filter
            city: Filter by city (e.g., 'Lahore')
            category: Filter by category (e.g., 'hotel', 'Mosque')
            min_price: Minimum price in PKR
            max_price: Maximum price in PKR
            min_rating: Minimum rating
            item_type: 'hotel' or 'attraction'
            availability: Only available items
        
        Returns:
            Filtered DataFrame
        """
        filtered = df.copy()
        
        # Apply availability filter
        if availability:
            filtered = filtered[filtered['availability'] == True]
        
        # City filter
        if city:
            filtered = filtered[filtered['city'].str.lower() == city.lower()]
        
        # Category filter
        if category:
            filtered = filtered[filtered['category'].str.lower().str.contains(category.lower(), na=False)]
        
        # Price filters
        if min_price is not None:
            filtered = filtered[filtered['price_pkr'] >= min_price]
        
        if max_price is not None:
            filtered = filtered[filtered['price_pkr'] <= max_price]
        
        # Rating filter
        if min_rating is not None:
            filtered = filtered[filtered['rating'] >= min_rating]
        
        # Type filter
        if item_type:
            filtered = filtered[filtered['type'] == item_type]
        
        return filtered
    
    def generate_recommendation_reasons(self, row: pd.Series, similarity_score: float) -> List[str]:
        """
        Generate reasons for why item was recommended
        
        Args:
            row: Item metadata
            similarity_score: Similarity score with query
        
        Returns:
            List of reason strings
        """
        reasons = []
        
        # Similarity match
        if similarity_score > 0.7:
            reasons.append(f"Excellent match ({similarity_score*100:.0f}% similarity)")
        elif similarity_score > 0.5:
            reasons.append(f"Good match ({similarity_score*100:.0f}% similarity)")
        else:
            reasons.append(f"Relevant match ({similarity_score*100:.0f}% similarity)")
        
        # Rating
        rating = row.get('rating', 0)
        if rating >= 4.5:
            reasons.append(f"Highly rated ({rating:.1f}/5.0)")
        elif rating >= 4.0:
            reasons.append(f"Well rated ({rating:.1f}/5.0)")
        
        # Price
        price = row.get('price_pkr', 0)
        if price == 0:
            reasons.append("Free entry")
        elif price < 10000:
            reasons.append(f"Budget-friendly (PKR {price:,.0f})")
        elif price < 20000:
            reasons.append(f"Mid-range (PKR {price:,.0f})")
        else:
            reasons.append(f"Premium (PKR {price:,.0f})")
        
        # Tags
        tags = str(row.get('tags', '')).split(',')
        if 'luxury' in tags:
            reasons.append("Luxury experience")
        if 'historical' in tags or 'heritage' in tags:
            reasons.append("Historical significance")
        if 'family-friendly' in tags or 'family' in tags:
            reasons.append("Family-friendly")
        
        return reasons
    
    def recommend(
        self,
        query: str,
        top_n: int = 10,
        city: str = 'Lahore',
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        item_type: Optional[str] = None,
        availability: bool = True
    ) -> List[Dict]:
        """
        Get recommendations based on query with filtering and re-ranking
        
        Args:
            query: User search query (e.g., "luxury hotel near Badshahi Mosque")
            top_n: Number of recommendations to return
            city: Filter by city
            category: Filter by category
            min_price: Minimum price in PKR
            max_price: Maximum price in PKR
            min_rating: Minimum rating
            item_type: 'hotel' or 'attraction'
            availability: Only available items
        
        Returns:
            List of recommendation dictionaries with scores and reasons
        """
        logger.info(f"\n🔍 Query: {query}")
        logger.info(f"Filters: city={city}, category={category}, price={min_price}-{max_price}, rating={min_rating}, type={item_type}")
        
        # Step 1: Encode query with DistilBERT
        query_embedding = self.encode_query(query)
        
        # Step 2: Compute cosine similarity with scikit-learn
        similarities = self.compute_similarity(query_embedding)
        
        # Add similarities to metadata
        results_df = self.metadata.copy()
        results_df['similarity_score'] = similarities
        
        # Step 3: Apply filters using Pandas
        filtered_df = self.apply_filters(
            results_df,
            city=city,
            category=category,
            min_price=min_price,
            max_price=max_price,
            min_rating=min_rating,
            item_type=item_type,
            availability=availability
        )
        
        logger.info(f"✓ Filtered from {len(results_df)} to {len(filtered_df)} items")
        
        if len(filtered_df) == 0:
            logger.warning("No results match filters")
            return []
        
        # Step 4: Re-rank by combined score
        # Combine similarity score (70%) + rating (30%)
        filtered_df['combined_score'] = (
            filtered_df['similarity_score'] * 0.7 +
            (filtered_df['rating'] / 5.0) * 0.3
        )
        
        # Sort by combined score
        filtered_df = filtered_df.sort_values('combined_score', ascending=False)
        
        # Get top N
        top_results = filtered_df.head(top_n)
        
        # Step 5: Format results with reasons
        recommendations = []
        for idx, row in top_results.iterrows():
            similarity_score = row['similarity_score']
            reasons = self.generate_recommendation_reasons(row, similarity_score)
            
            recommendation = {
                'item_id': int(row['item_id']),
                'name': row['name'],
                'description': row['description'],
                'type': row['type'],
                'category': row['category'],
                'city': row['city'],
                'latitude': float(row['latitude']),
                'longitude': float(row['longitude']),
                'price_pkr': float(row['price_pkr']),
                'rating': float(row['rating']),
                'tags': row['tags'],
                'availability': bool(row['availability']),
                'similarity_score': float(similarity_score),
                'combined_score': float(row['combined_score']),
                'reasons': reasons,
                'can_book': row['type'] == 'hotel',
                'can_save': True
            }
            
            recommendations.append(recommendation)
        
        logger.info(f"✓ Returning {len(recommendations)} recommendations")
        
        return recommendations
    
    def get_similar_items(
        self,
        item_id: int,
        top_n: int = 5,
        same_type: bool = True
    ) -> List[Dict]:
        """
        Find similar items to a given item
        
        Args:
            item_id: ID of the item
            top_n: Number of similar items to return
            same_type: Only return items of same type
        
        Returns:
            List of similar items
        """
        # Get item embedding
        item_embedding = self.embeddings_normalized[item_id].reshape(1, -1)
        
        # Compute similarities
        similarities = cosine_similarity(item_embedding, self.embeddings_normalized)[0]
        
        # Get item type
        item_type = self.metadata.iloc[item_id]['type']
        
        # Create results dataframe
        results_df = self.metadata.copy()
        results_df['similarity_score'] = similarities
        
        # Remove the item itself
        results_df = results_df[results_df['item_id'] != item_id]
        
        # Filter by type if requested
        if same_type:
            results_df = results_df[results_df['type'] == item_type]
        
        # Sort by similarity
        results_df = results_df.sort_values('similarity_score', ascending=False)
        
        # Get top N
        top_results = results_df.head(top_n)
        
        # Format results
        similar_items = []
        for idx, row in top_results.iterrows():
            similar_items.append({
                'item_id': int(row['item_id']),
                'name': row['name'],
                'type': row['type'],
                'category': row['category'],
                'price_pkr': float(row['price_pkr']),
                'rating': float(row['rating']),
                'similarity_score': float(row['similarity_score'])
            })
        
        return similar_items


def main():
    """Test recommendation engine"""
    engine = RecommendationEngine()
    
    # Test queries
    test_queries = [
        {
            'query': 'luxury hotel with spa and pool',
            'item_type': 'hotel',
            'min_rating': 8.0
        },
        {
            'query': 'historical Mughal architecture mosque',
            'item_type': 'attraction',
            'max_price': 1000
        },
        {
            'query': 'family-friendly budget hotel',
            'item_type': 'hotel',
            'max_price': 15000
        }
    ]
    
    for test in test_queries:
        print("\n" + "="*80)
        print(f"Query: {test['query']}")
        print("="*80)
        
        results = engine.recommend(**test, top_n=5)
        
        for i, rec in enumerate(results, 1):
            print(f"\n{i}. {rec['name']} ({rec['type']})")
            print(f"   Category: {rec['category']}")
            print(f"   Price: PKR {rec['price_pkr']:,.0f} | Rating: {rec['rating']:.1f}/5.0")
            print(f"   Similarity: {rec['similarity_score']*100:.1f}% | Score: {rec['combined_score']:.3f}")
            print(f"   Reasons:")
            for reason in rec['reasons']:
                print(f"     • {reason}")
            print(f"   Can book: {rec['can_book']}")


if __name__ == '__main__':
    main()
