import typing as tp


def cached(func: tp.Callable) -> tp.Callable:  # TODO: Implement caching
    """Decorator to cache the result of a function."""

    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)

    return wrapper
