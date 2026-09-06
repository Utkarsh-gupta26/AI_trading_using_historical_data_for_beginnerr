import sys
import os

# Add parent directory to path so server.py can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import LiveTradingHandler

class handler(LiveTradingHandler):
    pass
