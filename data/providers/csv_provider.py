"""
CSV and Parquet Data Providers.
"""
import os
import pandas as pd
from typing import Optional, Dict, Any
from .base import BaseDataProvider

class CSVDataProvider(BaseDataProvider):
    """Loads historical OHLCV data directly from CSV files."""
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.csv_dir = config.get("csv_dir", "data/raw")

    def fetch_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1d",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        file_path = os.path.join(self.csv_dir, f"{symbol}.csv")
        if not os.path.exists(file_path):
            file_path = os.path.join(self.csv_dir, f"{symbol}_{timeframe}.csv")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"CSV file not found for symbol: {symbol} in {self.csv_dir}")
        
        df = pd.read_csv(file_path)
        df = self.standardize_schema(df)
        if start_date:
            df = df[df.index >= pd.to_datetime(start_date)]
        if end_date:
            df = df[df.index <= pd.to_datetime(end_date)]
        return df


class ParquetDataProvider(BaseDataProvider):
    """Loads historical OHLCV data directly from Parquet files."""
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.parquet_dir = config.get("parquet_dir", "data/raw")

    def fetch_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1d",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        file_path = os.path.join(self.parquet_dir, f"{symbol}.parquet")
        if not os.path.exists(file_path):
            file_path = os.path.join(self.parquet_dir, f"{symbol}_{timeframe}.parquet")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Parquet file not found for symbol: {symbol} in {self.parquet_dir}")
        
        df = pd.read_parquet(file_path)
        df = self.standardize_schema(df)
        if start_date:
            df = df[df.index >= pd.to_datetime(start_date)]
        if end_date:
            df = df[df.index <= pd.to_datetime(end_date)]
        return df
