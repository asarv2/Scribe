# groups_processor.py
import json
from typing import Dict, List, Tuple, TypedDict, Optional, Set
import re
from app.services.base_processor import BaseProcessor
from langchain_core.messages import HumanMessage
import os
import uuid

class Term(TypedDict):
    term: str
    definition: str
    lectures: Dict[str, List[int]]
    type: str
    figures: List[str]

class Group(TypedDict):
    group: str
    definition: str
    terms: Dict[str, Term]
    subgroups: Optional[Dict[str, 'Group']]

class Topic(TypedDict):
    title: str
    content: str
    map: str
    class_id: str
    map_parent: Optional[str]
    map_id: str
    lectures: List[str]
    figures: List[str]
    type: str

class LectureMapping(TypedDict):
    id: str
    note_number: int

class GroupsProcessor(BaseProcessor):
    def __init__(self, 
                 terms: Dict[str, Term],
                 course_title: str,
                 course_description: str,
                 group: Optional[str] = None,
                 depth: int = 0,
                 max_depth: int = 2,
                 *args, **kwargs):
        """
        Initialize the GroupsProcessor.

        Args:
            terms (Dict[str, Term]): The terms to process.
            course_title (str): The title of the course.
            course_description (str): The description of the course.
            group (Optional[str], optional): The group to start at. If None, then start at the root group. Defaults to None.
            depth (int, optional): The depth of the current group. Used to determine which group to start at. Ex, setting depth to 2 will initialize the GroupsProcessor at the second level of groups (subgroups). Defaults to 0.
            max_depth (int, optional): The maximum depth to process. Defaults to 2.

        Raises:
            ValueError: If the depth is greater than the max depth.
            ValueError: If the depth or max depth is less than 1.
        """
        super().__init__(*args, **kwargs)
        self.terms = terms
        self.course_title = course_title
        self.course_description = course_description
        self.group = group if group else self.course_title
        if depth > max_depth:
            raise ValueError("Depth cannot be greater than max depth")
        elif depth < 1 or max_depth < 1:
            raise ValueError("Depth and max depth cannot be less than 1")
        self.depth = depth
        self.max_depth = max_depth

        self.groups: Dict[str, Group] = {}  # Initialize empty groups dictionary
        
        # prompts
        self.create_groups_prompt = f"""Your objective is to condense a large list of terms into a smaller list of groups, where each group is a more specific version of a term. You will also be given a hierarchy of what groups have already been created, so you do not recreate them. This is in the context of the course {self.course_title}.
        
        WHAT YOU SHOULD DO:
        1. Your groups should not be the same as the terms in the original list.
        2. You have a maximum of 5 groups, but less is better.
        3. Each group should be broad enough to span at least 3 terms in a meaningful way, but not too broad that it becomes a catch-all.
        4. Your response should be in the following format: <group>: <definition>. Do not number the groups or add special modifiers -- just follow the format.
        
        WHAT YOU SHOULD NOT DO:
        1. Refrain from making vague groups titled 'Advanced Topic' or 'Advanced Concepts'.
        2. Refrain from making groups that are broad, like 'Fundamentals of [course name]' or '[course name] Basics'.
        3. Do not repeat the same group name that is in the hierarchy, a group should always be more specific than the parent group.
        
        Here is a full example to assist you: 
        TERMS: convex set, convex combination, convex hull, carathéodory theorem, farkas' lemma, feasibility of linear inequalities, convex hull representation, convex combination representation, separating polyhedra, carathéodory's theorem application, convex set definition, production planning, surplus, production change cost, risk aversion parameter, maximum weight matching, sales force planning, portfolio selection with absolute deviation, portfolio selection with variance, smallest enclosing ball, production change cost linearization, sales force planning linearization, portfolio selection with absolute deviation linearization, smallest enclosing ball quadratic program, maximum weight matching integer program, spanning tree, fair prices, reduced cost, entering arc, adjusted flow, finding fair prices, identifying profitable arcs, adjusting flows, finding an initial feasible solution, economic interpretation of reduced costs
        
        HIERARCHY:
        Linear Programming (YOU ARE HERE)
        
        OUTPUT: 
        Convex Geometry: Key concepts related to convexity in linear programming, including convex sets, convex combinations, convex hulls, and their mathematical representations and theorems like Carathéodory's theorem and Farkas' lemma.
        
        Optimization Models and Applications: Practical uses of linear programming models in various fields such as production planning, sales force planning, portfolio selection, and maximum weight matching, including model-specific considerations like risk aversion and production change costs.
        
        Algorithmic Methods and Feasibility: Techniques for determining feasibility, adjusting flows, finding initial feasible solutions, and solving optimization problems, including spanning trees, entering arcs, and adjusted flow methods.
        
        Duality and Economic Interpretation: Concepts like reduced cost, fair prices, identifying profitable arcs, and the economic interpretation of optimization results, emphasizing duality principles and cost analysis in linear programs.
        
        Now it's your turn. Extract the most important topics from the following terms and hierarchy. """
        
        self.group_terms_prompt = f"Your objective is to decide which group each of the following Key Terms/Problem Types/Algorithm Solutions belong to, in the context of the course {self.course_title}. If there is only one group that the term is a part of, respond in the following format: <key term>: <GROUP number>. Here is an example to assist you: 'GROUPS: [simplex method]-[GROUP 1]\n[linear programming applications]-[GROUP 2]\n[network flow]-[GROUP 3]\n\nTERMS: primal problem, dual problem, network, node, knapsack problem, maximum weight matching\n\nOUTPUT: <primal problem>: <GROUP 1>\n\n<dual problem>: <GROUP 2>\n\n<network>: <GROUP 3>\n\n<node>: <GROUP 3>\n\n<knapsack problem>: <GROUP 2>\n\n<maximum weight matching>: <GROUP 3>'. For terms that are a part of multiple groups, respond in the following format: <key term>: <GROUP number><GROUP number>. Here is another example to assist you: 'GROUPS: [duality]-[GROUP 1]\n[convexity]-[GROUP 2]\n[network applications]-[GROUP 3]\n\nTERMS: dual problem, weak duality theorem, convex hull, farkas lemma, bellmans equation, dummy node\n\nOUTPUT: <dual problem>: <GROUP 1><GROUP 3>\n\n<weak duality theorem>: <GROUP 1><GROUP 2>\n\n<convex hull>: <GROUP 2>\n\n<farkas lemma>: <GROUP 1>\n\n<bellmans equation>: <GROUP 1>\n\n<dummy node>: <GROUP 1><GROUP 3>'."

    def generate_hierarchy(self, pointer_group: Optional[str] = None) -> str:
        """
        Generate the hierarchy of groups as an indented string.
        
        Args:
            pointer_group (Optional[str], optional): The group name where to show "(YOU ARE HERE)". 
                If None, no pointer is shown. Defaults to None.
        
        Returns:
            str: A string representation of the complete hierarchy, starting with the course title.
        """
        def build_hierarchy(groups, level=0):
            result = []
            indent = "  " * level
            for group_name, group_data in groups.items():
                if isinstance(group_data, dict):
                    # Use formatted group title if available, otherwise use group_name
                    group_title = group_data.get('group', group_name)
                    # Add pointer if this is the specified group
                    pointer = " (YOU ARE HERE)" if group_name == pointer_group else ""
                    result.append(f"{indent}{group_title}{pointer}")
                    
                    # Recursively process subgroups if they exist
                    if 'subgroups' in group_data and group_data['subgroups']:
                        result.extend(build_hierarchy(group_data['subgroups'], level + 1))
            
            return result

        # Start with course title
        # Add pointer if course title is the specified location
        pointer = " (YOU ARE HERE)" if self.course_title == pointer_group else ""
        hierarchy = [f"{self.course_title}{pointer}"]
        # Add all groups and their subgroups
        hierarchy.extend(build_hierarchy(self.groups, level=1))
        
        return "\n".join(hierarchy)
    
    async def generate_groups(self) -> List[str]:
        """
        Generate groups by processing terms in batches. If batch size is None, then process all terms at once.
        
        Returns:
            List[str]: Combined raw groups from all batches
        """
        terms = list(self.terms.keys())
        if len(terms) < 3:
            return []
        
        terms_str = "TERMS: " + ", ".join(terms)
        hierarchy_str = "HIERARCHY:\n" + self.generate_hierarchy(self.group)
        prompt = f"{self.create_groups_prompt}\n\n{terms_str}\n\n{hierarchy_str}\nOUTPUT: "

        try:
            message = HumanMessage(content=prompt)
            result = await self.robust_generate(message, model="gemini-1.5-flash-8b")
            return [line for line in result.split("\n") if line.strip()]
        except Exception as e:
            print("Error generating groups:", str(e))
            return []
    
    def clean_generated_groups(self, generated_groups: List[str]) -> Tuple[List[str], List[str], List[str]]:
        """
        Clean the generated groups and combine the results.
        
        Args:
            generated_groups (List[str]): The generated groups to clean
            
        Returns:
            Tuple[List[str], List[str], List[str]]: Combined group names, formatted group names, and definitions
        """
        # Combine and process all groups
        groups = []
        formatted_groups = []
        definitions = []
        for line in generated_groups:
            if ":" in line:
                sections = line.split(":")
                formatted_group = sections[0].strip().strip("*").strip()
                # make lowercase
                group = formatted_group.lower()
                # remove parentheses
                group = re.sub(r'\([^)]*\)', '', group)
                if group in groups:
                    print(f"Pruning group: {group}")
                else:
                    groups.append(group)
                    formatted_groups.append(formatted_group)
                    definitions.append(sections[1].strip())
        return groups, formatted_groups, definitions
    
    async def process_batch(self, terms: List[str], groups: List[str], batch_index: int) -> str:
        """
        Process a batch of terms and generate groups.
        """
        print(f"Processing batch {batch_index + 1}")
        
        # Format groups for prompt
        groups_prompt = "\n".join(f"[{group}]-[GROUP {idx + 1}]" for idx, group in enumerate(groups))
        
        # Generate group assignments
        message = HumanMessage(content=[
            {"type": "text", "text": self.group_terms_prompt},
            {"type": "text", "text": f"Use the following groups to decide which group each of the following terms belong to:\nGROUPS: {groups_prompt}\n\nTERMS: {', '.join(terms)}\nOUTPUT: "}
        ])
        
        return await self.robust_generate(message, model="gemini-1.5-flash-8b")
    
    def clean_result(self, result: str, terms: List[str], all_groups: List[str], formatted_groups: List[str], definitions: List[str]):
        """
        Clean up the result by getting it in the form of {
            "cleaned_group_name" : {
                    "group": "group",
                    "definition": "definition",
                    "terms": {
                        "cleaned_term_name": {
                            "term": "term",
                            "definition": "definition",
                            "lectures": {
                                "lecture_name": [1, 2, 3, e.t.c.] # list of slides
                            }
                            "type": "concept/problem/algorithm"
                        }
                    }
                }  
            }
        """
        grouped_terms = []
        
        # Split the result into lines
        for line in result.splitlines():   
            try:
                # Extract term between first set of angle brackets
                term_match = re.search(r'<([^>]+)>', line)
                if not term_match:
                    if line.strip() == "":
                        continue
                    else:
                        print(f"Could not parse term from line: {line}")
                        continue
                    
                term = term_match.group(1).strip()
                
                # Extract all GROUP numbers between angle brackets
                group_matches = re.findall(r'<GROUP\s*(\d+)>', line, re.IGNORECASE)
                if not group_matches:
                    print(f"No group numbers found in line: {line}")
                    continue
                    
                # Process each group assignment for this term
                for group_num in group_matches[0]: # only take the first group found
                    group_idx = int(group_num) - 1
                    if 0 <= group_idx < len(all_groups):
                        group = all_groups[group_idx]
                        formatted_group = formatted_groups[group_idx]
                        definition = definitions[group_idx]
                        
                        # finding original term from the cleaned term
                        complete_term = self.terms[term]
                        
                        # guaranteed that the groups are unique
                        if group in self.groups:
                            existing_terms = list(self.groups[group]["terms"].keys())
                            if term in existing_terms:
                                print(f"Pruning term: {term} in group: {group}")
                            else:
                                self.groups[group]["terms"][term] = complete_term
                                grouped_terms.append(term)
                        else:
                            self.groups[group] = {
                                "group": formatted_group,
                                "definition": definition,                                
                                "terms": {
                                    term: complete_term
                                }
                            }
                            grouped_terms.append(term)
                    else:
                        print(f"Warning: Group index {group_idx} out of range")
                    
            except (ValueError, IndexError, AttributeError) as e:
                print(f"Warning: Could not process line: {line}\nError: {str(e)}")
                continue
            
        print("Grouped terms: ", grouped_terms)
        
        ungrouped_terms = [term for term in terms if term not in grouped_terms]
        print("Could not group terms: ", ungrouped_terms)

    async def process_recursive_groups(self) -> None:
        """
        Process all subgroups recursively and return combined results.
        Returns a dictionary of all subgroups organized by their parent group.
        """
        if self.depth >= self.max_depth:  # Base case: max depth reached
            return
    
        for group_name, group_data in list(self.groups.items()):
            if len(group_data["terms"]) >= 3:
                print(f"Processing subgroup {group_name} at depth {self.depth + 1}")
                # Create new processor for subgroup
                subgroup_processor = GroupsProcessor(
                    terms=group_data["terms"],
                    course_title=self.course_title,
                    course_description=self.course_description,
                    group=group_name,
                    depth=self.depth + 1,
                    max_depth=self.max_depth,
                )
                group_subgroups = await subgroup_processor.process_groups()
                
                if group_subgroups:  # Only process if subgroups were created
                    # Keep track of which terms were successfully grouped into subgroups
                    terms_in_subgroups = set()
                    for subgroup_data in group_subgroups.values():
                        terms_in_subgroups.update(subgroup_data["terms"].keys())
                    
                    # Remove terms that were grouped in subgroups from the parent group
                    group_data["terms"] = {
                        term: data 
                        for term, data in group_data["terms"].items() 
                        if term not in terms_in_subgroups
                    }
                    
                    # Add the subgroups to the current group
                    self.groups[group_name]["subgroups"] = group_subgroups
        
    async def process_groups(self) -> Dict[str, Group]:
        """
        Process terms, extract content in batches, and generates groups.
        
        Returns:
            Dict[str, Group]: The complete group hierarchy
        """
        if len(self.terms) < 3:  # Base case: not enough terms to group
            return {}
        
        print(f"--------------- Processing groups at depth {self.depth}---------------")
        
        # Generate and process initial groups
        raw_generated_groups = await self.generate_groups()
        generated_groups, formatted_groups, definitions = self.clean_generated_groups(raw_generated_groups)
        print("Generated groups: ", generated_groups)

        terms = list(self.terms.keys())
        
        result = await self.process_batch(terms, generated_groups, 0)
        self.clean_result(result, terms, generated_groups, formatted_groups, definitions)

        # Process subgroups recursively
        await self.process_recursive_groups()
        
        return self.groups

    def reformat_topics(self, lecture_mapping: Dict[str, LectureMapping], class_id: str) -> List[Topic]:
        """Reformat groups into topics for database storage."""
        map_id = str(uuid.uuid4())

        def create_topic_entry(
            title: str,
            content: str,
            map_id: str,
            map_parent: Optional[str],
            lectures: List[str],
            figures: List[str],
            type_: str
        ) -> Topic:
            return {
                "title": title,
                "content": content,
                "map": map_id,
                "class": class_id,
                "map_parent": map_parent,
                "map_id": str(uuid.uuid4()),
                "lectures": lectures,
                "figures": figures,
                "type": type_
            }

        def process_group(
            group_name: str,
            group_data: Group,
            parent_id: Optional[str] = None
        ) -> List[Topic]:
            topics: List[Topic] = []

            if not group_data:
                print(f"Group data is undefined for group: {group_name}")
                return topics

            # Create entry for the group itself
            group_entry = create_topic_entry(
                group_data['group'] or group_name,
                group_data['definition'] or "",
                map_id,
                parent_id,
                [],
                [],
                "group"
            )
            topics.append(group_entry)

            # Process all terms in this group
            if group_data['terms']:
                for term_data in group_data['terms'].values():
                    if not term_data:
                        continue

                    # Convert lecture names to ids using the mapping
                    lecture_names = term_data['lectures'].keys()
                    lecture_ids = [lecture_mapping[name]['id'] for name in lecture_names]

                    # Get the term type from the term data
                    term_type = term_data['type'] or "term"
                    if term_type == "Key Terms":
                        term_type = "term"
                    elif term_type == "Problem Types":
                        term_type = "problem"
                    elif term_type == "Algorithm Solutions":
                        term_type = "algorithm"

                    term_entry = create_topic_entry(
                        term_data['term'] or "",
                        term_data['definition'] or "",
                        map_id,
                        group_entry['map_id'],
                        lecture_ids,
                        term_data.get('figures', []),
                        term_type
                    )
                    topics.append(term_entry)

            # Recursively process subgroups
            if group_data.get('subgroups'):
                for subgroup_name, subgroup_data in group_data['subgroups'].items():
                    if not subgroup_data:
                        continue
                    subgroup_topics = process_group(
                        subgroup_name,
                        subgroup_data,
                        group_entry['map_id']
                    )
                    topics.extend(subgroup_topics)

            return topics

        # Create root node for course
        root_id = str(uuid.uuid4())
        root_node: Topic = {
            "title": self.course_title,
            "content": self.course_description,
            "map": map_id,
            "class": class_id,
            "map_parent": None,
            "map_id": root_id,
            "lectures": [mapping['id'] for mapping in lecture_mapping.values()],
            "figures": [],
            "type": "group"
        }

        # Process all groups and collect topics
        all_topics = [root_node]
        for group_name, group_data in self.groups.items():
            if not group_data:
                continue
            all_topics.extend(process_group(group_name, group_data, root_id))

        return all_topics