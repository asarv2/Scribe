import logging
from collections import defaultdict
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

async def get_mapped_outcomes(
    supabase,
    class_id: str,
    outcome_ids: List[str],
    *,
    preserve_input_order: bool = True,   # set True if you want to keep the caller’s order
) -> Tuple[Dict[int, str], str]:
    """
    Map outcome reference numbers to ids and return a human-readable description block.

    Output
    ------
    ref_map      : Dict[int, str]   # 1-based ref-number → outcome-id
    description  : str              # formatted lines, ready for display / logs
    """

    if not outcome_ids:
        return {}, ""                          # nothing to do

    logger.info("Fetching %d outcomes for class %s", len(outcome_ids), class_id)

    # ── 1. Fetch outcomes ────────────────────────────────────────────────────────
    outcome_rows = (
        supabase
        .table("outcomes")
        .select("*")
        .eq("class", class_id)
        .in_("id", outcome_ids)
        .execute()
        .data
        or []
    )
    if not outcome_rows:
        logger.warning("No matching outcomes found for ids: %s", outcome_ids)
        return {}, ""

    # ── 2. Fetch objectives for those outcomes ──────────────────────────────────
    outcome_id_set = {row["id"] for row in outcome_rows}
    objective_rows = (
        supabase
        .table("objectives")
        .select("id,outcome,title")
        .in_("outcome", list(outcome_id_set))
        .execute()
        .data
        or []
    )
    objectives_by_outcome: Dict[str, List[str]] = defaultdict(list)
    for obj in objective_rows:
        objectives_by_outcome[obj["outcome"]].append(obj["title"])

    # ── 3. Sort outcomes (caller may keep order) ────────────────────────────────
    if preserve_input_order:
        # keep the sequence given by the caller
        sorted_outcomes = sorted(
            outcome_rows,
            key=lambda row: outcome_ids.index(row["id"])
        )
    else:
        # alphabetical by outcome name / title
        sorted_outcomes = sorted(outcome_rows, key=lambda row: row.get("name", ""))

    # ── 4. Build output ─────────────────────────────────────────────────────────
    ref_map: Dict[int, str] = {}
    description_lines: List[str] = []

    for idx, row in enumerate(sorted_outcomes, 1):          # ref numbers are 1-based
        outcome_id   = row["id"]
        outcome_name = row.get("name", f"Outcome {idx}")
        outcome_desc = (row.get("description") or "").strip()

        # reference mapping
        ref_map[idx] = outcome_id

        # description block
        description_lines.append(f"{outcome_name} -> OUTCOME {idx}")
        if outcome_desc:
            description_lines.append(f"  {outcome_desc}")

        # dedupe via lowercase, then title-case for display
        raw_objectives = objectives_by_outcome.get(outcome_id, [])
        unique_lower   = {title.lower() for title in raw_objectives}
        sorted_lower   = sorted(unique_lower)
        titlecased      = [s.title() for s in sorted_lower]

        description_lines.append(f"  Objectives: [{', '.join(titlecased)}]")
        description_lines.append("")                         # blank line between outcomes

    # strip trailing blank line for a clean ending
    if description_lines and description_lines[-1] == "":
        description_lines.pop()

    return ref_map, "\n".join(description_lines)
