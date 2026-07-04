"""Allow `python3 -m cli` to work as an entry point.

Python 3.9+ does not allow `-m` on a package without a __main__.py.
This delegates to cli.__init__.main().
"""
from cli import main

if __name__ == "__main__":
    main()
