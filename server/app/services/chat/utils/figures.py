import re
from collections import defaultdict
from typing import Dict, List, Tuple
import json
import logging
import math

logger = logging.getLogger(__name__)

def clean_figures(text: str, fig_by_index: Dict[int, str]) -> str:
    """
    Replace {1}, {2,3}, … with <FIGURE>{figure_id}</FIGURE>.
    If an index is missing (figure failed), the token is dropped.
    """

    def _sub(match: re.Match) -> str:
        nums = (int(n) for n in match.group(1).split(','))
        embeds = [
            f"<FIGURE>{fig_by_index[i]}</FIGURE>"
            for i in nums
            if i in fig_by_index               # keep only successes
        ]
        return "".join(embeds)                 # empty string if none survived

    return re.sub(r"\{([\d\s,]+)\}", _sub, text)
