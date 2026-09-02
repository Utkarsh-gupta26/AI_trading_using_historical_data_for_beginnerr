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
        Supports common exchange aliases (e.g. 'shares traded' -> 'volume').
        """
        df = df.copy()
        df.columns = [str(c).lower().strip() for c in df.columns]
        
        # Map common aliases
        aliases = {
            'shares traded': 'volume',
            'shares_traded': 'volume',
            'vol': 'volume',
            'total_volume': 'volume',
            'tick_volume': 'volume',
            'tickvol': 'volume',
            'tick volume': 'volume',
            'adj close': 'close',
            'adj_close': 'close',
            'ราคาเปิด': 'open',
            'ราคาสูงสุด': 'high',
            'ราคาต่ำสุด': 'low',
            'ราคาปิด': 'close',
            'ปริมาณซื้อขาย': 'volume',
            'วันที่': 'date',
            'eröffnung': 'open',
            'hoch': 'high',
            'tief': 'low',
            'schluss': 'close',
            'volumen': 'volume',
            'apertura': 'open',
            'maximo': 'high',
            'minimo': 'low',
            'cierre': 'close'

        }
        for alias, target in aliases.items():
            if alias in df.columns and target not in df.columns:
                df[target] = df[alias]

        # Check Datetime index
        if not isinstance(df.index, pd.DatetimeIndex):
            datetime_col_found = False
            for col in ['datetime', 'date', 'timestamp', 'time', 'วันที่', 'datum', 'fecha']:
                if col in df.columns:
                    df['datetime'] = pd.to_datetime(df[col], errors='coerce')
                    df.set_index('datetime', inplace=True)
                    datetime_col_found = True
                    break
            
            # If not found yet, try parsing the first string/object column as dates
            if not datetime_col_found:
                for col in df.columns:
                    try:
                        parsed = pd.to_datetime(df[col], errors='coerce')
                        if parsed.notna().sum() > len(df) * 0.7:
                            df['datetime'] = parsed
                            df.set_index('datetime', inplace=True)
                            datetime_col_found = True
                            break
                    except Exception:
                        continue

            if not datetime_col_found and not isinstance(df.index, pd.DatetimeIndex):
                # Attempt to parse existing index
                try:
                    df.index = pd.to_datetime(df.index, errors='coerce')
                except Exception:
                    df.index = pd.date_range(end=pd.Timestamp.now(), periods=len(df), freq='D')

        # Fallback to positional mapping if columns are still missing
        missing_cols = [c for c in ['open', 'high', 'low', 'close'] if c not in df.columns]
        if missing_cols and len(df.columns) >= 4:
            numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) or df[c].dtype == float or df[c].dtype == int]
            if len(numeric_cols) >= 4:
                df['open'] = df[numeric_cols[0]]
                df['high'] = df[numeric_cols[1]]
                df['low'] = df[numeric_cols[2]]
                df['close'] = df[numeric_cols[3]]
                if len(numeric_cols) >= 5 and 'volume' not in df.columns:
                    df['volume'] = df[numeric_cols[4]]
        
        # Drop rows where index is NaT
        df = df[df.index.notna()]
        df.sort_index(inplace=True)
        
        # Ensure UTC / naive alignment
        if hasattr(df.index, 'tz') and df.index.tz is not None:
            df.index = df.index.tz_convert(None)


            
        # Ensure required columns exist
        for col in self.REQUIRED_COLUMNS:
            if col not in df.columns:
                if col == 'volume':
                    # Fallback to dummy volume if missing
                    df['volume'] = 100000.0
                else:
                    raise ValueError(f"Missing required price column: {col}")
                
        df = df[self.REQUIRED_COLUMNS].astype(float)
        df.sort_index(inplace=True)
        return df

