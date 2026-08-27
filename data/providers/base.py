"""
Abstract Base Data Provider Interface.
"""
from abc import ABC, abstractmethod
import pandas as pd
from typing import Optional, List, Dict, Any

class BaseDataProvider(ABC):
    """
    Abstract interface defining the standardized data loading contract.
    Guarantees clean OHLCV outputs with strict schema adherence.
    """
    REQUIRED_COLUMNS = ['open', 'high', 'low', 'close', 'volume']

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    @abstractmethod
    def fetch_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Fetch historical OHLCV data.
        Returns a DataFrame indexed by Datetime (timezone-naive or UTC standardized)
        with columns: ['open', 'high', 'low', 'close', 'volume'].
        """
        pass

    def standardize_schema(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Standardizes column names to lowercase and sets datetime index.
        """
        df = df.copy()
        df.columns = [str(c).lower().strip() for c in df.columns]
        
        # Check Datetime index
        if not isinstance(df.index, pd.DatetimeIndex):
            for col in ['datetime', 'date', 'timestamp', 'time']:
                if col in df.columns:
                    df['datetime'] = pd.to_datetime(df[col])
                    df.set_index('datetime', inplace=True)
                    break
        
        # Ensure UTC / naive alignment
        if df.index.tz is not None:
            df.index = df.index.tz_convert(None)
            
        # Ensure required columns exist
        for col in self.REQUIRED_COLUMNS:
            if col not in df.columns:
                raise ValueError(f"Missing required price column: {col}")
                
        df = df[self.REQUIRED_COLUMNS].astype(float)
        df.sort_index(inplace=True)
        return df
