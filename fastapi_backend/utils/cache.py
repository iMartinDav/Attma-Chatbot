import os
import pickle
import hashlib
import inspect
from typing import Any, Dict, Optional, Callable, Tuple, List
from functools import wraps
import json
import time
import logging

from .logging import get_logger

logger = get_logger(__name__)


class CallCache:
    """
    A cache for storing function calls and their results.
    Similar to the 'called_functions' list in the R code, but more sophisticated.
    """
    
    def __init__(self, cache_dir: str = "/tmp/fastapi_cache"):
        """
        Initialize a new cache.
        
        Args:
            cache_dir: The directory to store cached results in
        """
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        self.called_functions = set()
        self.plots = {}
        self.summaries = {}
        
    def get_call_signature(self, func: Callable, args: Tuple, kwargs: Dict) -> str:
        """
        Get a unique signature for a function call.
        
        Args:
            func: The function that was called
            args: The positional arguments to the function
            kwargs: The keyword arguments to the function
            
        Returns:
            A string that uniquely identifies this function call
        """
        # Get the function name
        func_name = func.__name__
        
        # Combine args and kwargs into a single dictionary
        params = inspect.signature(func).parameters
        param_names = list(params.keys())
        
        # Map positional args to parameter names
        arg_dict = {param_names[i]: arg for i, arg in enumerate(args) if i < len(param_names)}
        
        # Add keyword args (will override positional args if there's a conflict)
        arg_dict.update(kwargs)
        
        # Remove 'self' and 'cls' from arguments if present
        arg_dict.pop("self", None)
        arg_dict.pop("cls", None)
        
        # Create a deterministic representation of the arguments
        arg_str = json.dumps(arg_dict, sort_keys=True, default=str)
        
        # Create a unique hash for this function call
        hash_obj = hashlib.md5(f"{func_name}:{arg_str}".encode())
        return hash_obj.hexdigest()
    
    def is_cached(self, func: Callable, args: Tuple, kwargs: Dict) -> bool:
        """
        Check if a function call is cached.
        
        Args:
            func: The function to check
            args: The positional arguments to the function
            kwargs: The keyword arguments to the function
            
        Returns:
            True if the function call is cached, False otherwise
        """
        signature = self.get_call_signature(func, args, kwargs)
        return signature in self.called_functions
    
    def add_call(self, func: Callable, args: Tuple, kwargs: Dict) -> str:
        """
        Add a function call to the cache.
        
        Args:
            func: The function that was called
            args: The positional arguments to the function
            kwargs: The keyword arguments to the function
            
        Returns:
            The signature of the function call
        """
        signature = self.get_call_signature(func, args, kwargs)
        self.called_functions.add(signature)
        return signature
    
    def get_cache_path(self, signature: str) -> str:
        """
        Get the path to the cached result for a function call.
        
        Args:
            signature: The signature of the function call
            
        Returns:
            The path to the cached result
        """
        return os.path.join(self.cache_dir, f"{signature}.pkl")
    
    def cache_result(self, signature: str, result: Any) -> None:
        """
        Cache the result of a function call.
        
        Args:
            signature: The signature of the function call
            result: The result of the function call
        """
        cache_path = self.get_cache_path(signature)
        try:
            with open(cache_path, "wb") as f:
                pickle.dump(result, f)
        except Exception as e:
            logger.warning(f"Failed to cache result: {e}")
    
    def get_cached_result(self, signature: str) -> Optional[Any]:
        """
        Get the cached result of a function call.
        
        Args:
            signature: The signature of the function call
            
        Returns:
            The cached result, or None if it's not cached
        """
        cache_path = self.get_cache_path(signature)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "rb") as f:
                    return pickle.load(f)
            except Exception as e:
                logger.warning(f"Failed to load cached result: {e}")
                return None
        return None
    
    def add_plot(self, signature: str, plot: Any) -> None:
        """
        Add a plot to the cache.
        
        Args:
            signature: The signature of the function call that generated the plot
            plot: The plot object
        """
        self.plots[signature] = plot
    
    def get_plot(self, signature: str) -> Optional[Any]:
        """
        Get a plot from the cache.
        
        Args:
            signature: The signature of the function call that generated the plot
            
        Returns:
            The plot object, or None if it's not cached
        """
        return self.plots.get(signature)
    
    def add_summary(self, signature: str, summary: Dict) -> None:
        """
        Add a summary to the cache.
        
        Args:
            signature: The signature of the function call that generated the summary
            summary: The summary dictionary
        """
        self.summaries[signature] = summary
    
    def get_summary(self, signature: str) -> Optional[Dict]:
        """
        Get a summary from the cache.
        
        Args:
            signature: The signature of the function call that generated the summary
            
        Returns:
            The summary dictionary, or None if it's not cached
        """
        return self.summaries.get(signature)
    
    def clear(self) -> None:
        """Clear all cached data."""
        self.called_functions.clear()
        self.plots.clear()
        self.summaries.clear()
        
        # Also clear cache files
        for filename in os.listdir(self.cache_dir):
            if filename.endswith(".pkl"):
                os.remove(os.path.join(self.cache_dir, filename))


# Global cache instance
cache = CallCache()


def cached(ttl: Optional[int] = None):
    """
    Decorator for caching function results.
    
    Args:
        ttl: Time to live in seconds (default: None, cache indefinitely)
        
    Returns:
        A decorator that caches function results
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Check if function is already cached
            signature = cache.get_call_signature(func, args, kwargs)
            
            # Check if result is in cache and not expired
            cached_result = cache.get_cached_result(signature)
            if cached_result is not None:
                # If ttl is specified, check if result is expired
                if ttl is not None:
                    # Get the timestamp from the cached result
                    result, timestamp = cached_result
                    # Check if result is expired
                    if time.time() - timestamp <= ttl:
                        logger.debug(f"Cache hit for {func.__name__}")
                        return result
                else:
                    # No TTL, just return the cached result
                    logger.debug(f"Cache hit for {func.__name__}")
                    return cached_result
            
            # Cache miss, call the function
            logger.debug(f"Cache miss for {func.__name__}")
            result = func(*args, **kwargs)
            
            # Cache the result with a timestamp if ttl is specified
            if ttl is not None:
                cache.cache_result(signature, (result, time.time()))
            else:
                cache.cache_result(signature, result)
            
            # Add the function call to the cache
            cache.add_call(func, args, kwargs)
            
            return result
        return wrapper
    return decorator 