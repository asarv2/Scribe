import logging
from collections import defaultdict
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


async def get_mapped_outcomes(
    supabase,
    class_id: str,
    outcome_ids: List[str],
    *,
    preserve_input_order: bool = True,  # keep caller order if requested
) -> Tuple[Dict[int, str], str, str]:
    """
    Map outcome reference numbers to ids and build two human-readable blocks.

    Returns
    -------
    ref_map            : Dict[int, str]   # 1-based ref-number → outcome-id
    description        : str              # full block (numbers + objectives)
    plain_description  : str              # names & descriptions only
    """
    if not outcome_ids:
        return {}, "", ""

    logger.info("Fetching %d outcomes for class %s", len(outcome_ids), class_id)

    # ── 1. outcomes ────────────────────────────────────────────────────────────
    outcome_rows = (
        supabase.table("outcomes")
        .select("*")
        .eq("class", class_id)
        .in_("id", outcome_ids)
        .execute()
        .data
        or []
    )
    if not outcome_rows:
        logger.warning("No matching outcomes found for ids: %s", outcome_ids)
        return {}, "", ""

    # ── 2. objectives (titles only) ────────────────────────────────────────────
    outcome_id_set = {row["id"] for row in outcome_rows}
    objective_rows = (
        supabase.table("objectives")
        .select("id,outcome,title")
        .in_("outcome", list(outcome_id_set))
        .execute()
        .data
        or []
    )
    objectives_by_outcome: Dict[str, List[str]] = defaultdict(list)
    for obj in objective_rows:
        objectives_by_outcome[obj["outcome"]].append(obj["title"])

    # ── 3. sort outcomes ───────────────────────────────────────────────────────
    if preserve_input_order:
        sorted_outcomes = sorted(outcome_rows, key=lambda r: outcome_ids.index(r["id"]))
    else:
        sorted_outcomes = sorted(outcome_rows, key=lambda r: r.get("name", ""))

    # ── 4. build both description blocks ───────────────────────────────────────
    ref_map: Dict[int, str] = {}
    full_lines: List[str] = []  # existing format
    plain_lines: List[str] = []  # NEW format

    for idx, row in enumerate(sorted_outcomes, 1):  # references are 1-based
        outcome_id = row["id"]
        outcome_name = row.get("name", f"Outcome {idx}")
        outcome_desc = (row.get("description") or "").strip()

        # reference mapping
        ref_map[idx] = outcome_id

        # ── full description (old behaviour) ────────────────────────────────
        full_lines.append(f"{outcome_name} -> OUTCOME {idx}")
        if outcome_desc:
            full_lines.append(f"  {outcome_desc}")

        raw_objectives = objectives_by_outcome.get(outcome_id, [])
        unique_lower = {t.lower() for t in raw_objectives}
        objectives = [s.title() for s in sorted(unique_lower)]

        full_lines.append(f"  Objectives: [{', '.join(objectives)}]")
        full_lines.append("")  # blank line

        # ── plain description (name + desc) ─────────────────────────────────
        plain_lines.append(outcome_name)
        if outcome_desc:
            plain_lines.append(f"  {outcome_desc}")
        plain_lines.append("")

    # strip trailing blank lines
    if full_lines and full_lines[-1] == "":
        full_lines.pop()
    if plain_lines and plain_lines[-1] == "":
        plain_lines.pop()

    description = "\n".join(full_lines)
    plain_description = "\n".join(plain_lines)

    return ref_map, description, plain_description
