import functools
import types as t

from backend.common.logging import log


def safe_call(func: t.FunctionType) -> t.FunctionType:
    """Decorator to catch exceptions in a function and log them."""

    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        try:
            return func(self, *args, **kwargs)
        except Exception as e:
            log.error(
                f"Error in {func.__name__}",
                error=str(e),
                func=func.__name__,
                class_name=self.__class__.__name__,
                exc_info=e,
            )

    return wrapper
