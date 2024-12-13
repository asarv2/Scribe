# groups_processor.py
import json
from typing import Dict, List, Tuple
import re
from lecture.condense.base_processor import BaseProcessor
from langchain_core.messages import HumanMessage
import os

class GroupsProcessor(BaseProcessor):
    def __init__(self, 
                 terms: Dict[str, Dict],
                 depth: int = 1,
                 max_depth: int = 2,
                 save_groups: bool = False,
                 *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.terms = terms
        if depth > max_depth:
            raise ValueError("Depth cannot be greater than max depth")
        elif depth < 1 or max_depth < 1:
            raise ValueError("Depth and max depth cannot be less than 1")
        self.depth = depth
        self.max_depth = max_depth
        self.summary_type = ("sub" * (depth - 1)) + "groups"
        self.save_groups = save_groups
        
        # Generate timestamp for output file
        os.makedirs(os.path.join(self.output_dir, self.timestamp, self.summary_type), exist_ok=True)
        self.json_output_file = os.path.join(self.output_dir, self.timestamp, self.summary_type, "summary.json")
        self.text_output_file = os.path.join(self.output_dir, self.timestamp, self.summary_type, "summary.txt")
        
        # prompts
        self.create_groups_prompt = f"Your objective is to condense a large list of terms into a smaller list of groups, where each group is a more specific version of a term. Your groups should not be the same as the terms in the original list. Refrain from making vague groups titled 'Advanced Topic' or 'Advanced Concepts'. Each group should be broad enough to span at least 3 terms in a meaningful way, but not too broad that it becomes a catch-all. If you are unsure, less groups is better, so that each group can have good depth. Your response should be in the following format: <group>: <definition>. Do not number the groups or add special modifiers -- just follow the format.Extract the most important topics from the following terms: "
        self.group_terms_prompt = f"Your objective is to decide which group each of the following Key Terms/Problem Types/Algorithm Solutions belong to, in the context of the course {self.course_title}. If there is only one group that the term is a part of, respond in the following format: <key term>: <GROUP number>. Here is an example to assist you: 'GROUPS: [simplex method]-[GROUP 1]\n[linear programming applications]-[GROUP 2]\n[network flow]-[GROUP 3]\n\nTERMS: primal problem, dual problem, network, node, knapsack problem, maximum weight matching\n\nOUTPUT: <primal problem>: <GROUP 1>\n\n<dual problem>: <GROUP 2>\n\n<network>: <GROUP 3>\n\n<node>: <GROUP 3>\n\n<knapsack problem>: <GROUP 2>\n\n<maximum weight matching>: <GROUP 3>'. For terms that are a part of multiple groups, respond in the following format: <key term>: <GROUP number><GROUP number>. Here is another example to assist you: 'GROUPS: [duality]-[GROUP 1]\n[convexity]-[GROUP 2]\n[network applications]-[GROUP 3]\n\nTERMS: dual problem, weak duality theorem, convex hull, farkas lemma, bellmans equation, dummy node\n\nOUTPUT: <dual problem>: <GROUP 1><GROUP 3>\n\n<weak duality theorem>: <GROUP 1><GROUP 2>\n\n<convex hull>: <GROUP 2>\n\n<farkas lemma>: <GROUP 1>\n\n<bellmans equation>: <GROUP 1>\n\n<dummy node>: <GROUP 1><GROUP 3>'."
        
        # load the previous groups if they exist
        if self.regenerate_timestamp:
            self.groups = {}
        else:
            filename = os.path.join(self.output_dir, self.timestamp, self.summary_type, "summary.json")
            with open(filename, "r") as file:
                self.groups = json.load(file)
            
    
    def generate_groups(self, batch_size: int = None) -> List[str]:
        """
        Generate groups by processing terms in batches. If batch size is None, then process all terms at once.
        
        Args:
            category (str): The category to process
            batch_size (int): Number of terms to process in each batch
            
        Returns:
            List[str]: Combined raw groups from all batches
        """
        terms = list(self.terms.keys())
        batches = [terms[i:i + batch_size] for i in range(0, len(terms), batch_size)] if batch_size else [terms]
        all_raw_groups = []
        
        for i, batch in enumerate(batches):
            prompt = self.create_groups_prompt + ', '.join(batch)
            try:
                batch_results = self.robust_generate(HumanMessage(content=[{"type": "text", "text": prompt}]))
                all_raw_groups.extend(batch_results.split('\n'))
            except Exception as e:
                print(f"Error processing batch {i}: {e}")
                continue
        
        return all_raw_groups
    
    
    def clean_generated_groups(self, generated_groups: List[str]) -> Tuple[List[str], List[str]]:
        """
        Clean the generated groups and combine the results.
        
        Args:
            generated_groups (List[str]): The generated groups to clean
            
        Returns:
            Tuple[List[str], List[str]]: Combined group names and formatted group names
        """
        # Combine and process all groups
        groups = []
        formatted_groups = []
        for line in generated_groups:
            if ":" in line:
                formatted_group = line.split(":")[0].strip().strip("*").strip()
                # make lowercase
                group = formatted_group.lower()
                # remove parentheses
                group = re.sub(r'\([^)]*\)', '', group)
                if group in groups:
                    print(f"Pruning group: {group}")
                else:
                    groups.append(group)
                    formatted_groups.append(formatted_group)
        return groups, formatted_groups
    
    def process_batch(self, 
                      terms: List[str], 
                      groups: List[str],
                      batch_index: int) -> str:
        """
        Process a batch of terms and generate groups.
        """
        print(f"********** Processing batch {batch_index + 1} **********")
        
        # Format groups for prompt
        groups_prompt = "\n".join(f"[{group}]-[GROUP {idx + 1}]" for idx, group in enumerate(groups))
        
        # Generate group assignments
        message = HumanMessage(content=[
            {"type": "text", "text": self.group_terms_prompt},
            {"type": "text", "text": f"Use the following groups to decide which group each of the following terms belong to: GROUPS: {groups_prompt}\n\nTERMS: {terms}\nOUTPUT: "}
        ])
        
        return self.robust_generate(message)
    
    def clean_result(self, result: str, terms: List[str], all_groups: List[str], formatted_groups: List[str]):
        """
        Clean up the result by getting it in the form of {
            "cleaned_group_name" : {
                    "group": "group",
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
                for group_num in group_matches:
                    group_idx = int(group_num) - 1
                    if 0 <= group_idx < len(all_groups):
                        group = all_groups[group_idx]
                        formatted_group = formatted_groups[group_idx]
                        
                        # finding original term from the cleaned term
                        complete_term = self.terms[term]
                        
                        # guaranteed that the groups are unique
                        if group in self.groups:
                            existing_terms = list(self.groups[group]["terms"].keys())
                            if term in existing_terms:
                                print(f"Pruning term: {term} in group: {group}")
                            else:
                                grouped_terms.append(term)
                                self.groups[group]["terms"][term] = complete_term
                        else:
                            self.groups[group] = {
                                "group": formatted_group,
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

    def process_groups(self,
                      batch_size = None) -> Dict[str, List[str]]:
        """
        Process terms, extract content in batches, and generates groups.
        
        Args:
            batch_size: the number of terms to process in each batch. If None, then process all terms at once.
        """
        if len(self.terms) < 3:  # Base case: not enough terms to group
            return {}
        
        print(f"--------------- Processing groups at depth {self.depth}---------------")
        
        # Generate and process initial groups
        raw_generated_groups = self.generate_groups(batch_size)
        generated_groups, formatted_groups = self.clean_generated_groups(raw_generated_groups)
        print("Generated groups: ", generated_groups)

        terms = list(self.terms.keys())
        
        if batch_size is None:
            # Process all terms at once
            try:
                result = self.process_batch(terms, generated_groups, 0)
                self.clean_result(result, terms, generated_groups, formatted_groups)
            except Exception as e:
                print(f"Error processing groups: {e}")
        else:
            # Process in batches
            for i in range(0, len(terms), batch_size):
                batch = terms[i:i + batch_size]
                try:
                    result = self.process_batch(batch, generated_groups, i // batch_size)
                    batch_groups = self.clean_result(result, batch, generated_groups, formatted_groups)
                    # Merge batch results into current_groups
                    for group_name, group_data in batch_groups.items():
                        if group_name in self.groups:
                            self.groups[group_name]["terms"].update(group_data["terms"])
                        else:
                            self.groups[group_name] = group_data
                except Exception as e:
                    print(f"Error processing batch {i // batch_size}: {e}")

        # Save results for current depth
        self.save_groups_json(self.json_output_file)
        if self.save_groups:
            self.save_groups_text(self.text_output_file)
        
        # Process subgroups recursively
        self._process_recursive_groups()

    def _process_recursive_groups(self) -> Dict[str, Dict]:
        """
        Process all subgroups recursively and return combined results.
        Returns a dictionary of all subgroups organized by their parent group.
        """
        if self.depth >= self.max_depth:  # Base case: max depth reached
            return
    
        
        for group_name, group_data in self.groups.items():
            if len(group_data["terms"]) >= 3:
                print(f"Processing subgroup {group_name} at depth {self.depth + 1}")
                # Create new processor for subgroup
                subgroup_processor = GroupsProcessor(
                    terms=group_data["terms"],
                    depth=self.depth + 1,
                    max_depth=self.max_depth,
                    save_groups=self.save_groups,
                    course_title=self.course_title,
                    course_code=self.course_code,
                    output_dir=self.output_dir,
                    timestamp=self.timestamp,
                    regenerate_timestamp=self.regenerate_timestamp,
                )
                subgroup_processor.process_groups()
                self.groups[group_name]["subgroups"] = subgroup_processor.groups
                
        self.save_groups_json(os.path.join(self.output_dir, self.timestamp, "sub" + self.summary_type, "summary.json"))
        if self.save_groups:
            self.save_groups_text(os.path.join(self.output_dir, self.timestamp, "sub" + self.summary_type, "summary.txt"))
        
    def save_groups_json(self, file_path: str):
        """Save groups to JSON, including all subgroups"""
        with open(file_path, "w") as file:
            json.dump(self.groups, file, indent=4)
    
    def save_groups_text(self, file_path: str):
        """Save groups to text file, including all subgroups"""
        def write_groups(groups, file, level=0):
            indent = "  " * level
            for group_name, group_data in groups.items():
                # Handle different group data structures
                if isinstance(group_data, dict):
                    # If it's a group with metadata
                    if 'group' in group_data:
                        group_title = group_data['group']
                    else:
                        group_title = group_name
                    
                    file.write(f"{indent}{group_title}\n")
                    
                    if 'subgroups' in group_data and group_data['subgroups']: # Recursively write subgroups if they exist
                        write_groups(group_data['subgroups'], file, level + 1)
                    elif 'terms' in group_data: # Write terms if they exist
                        terms = group_data['terms']
                        if isinstance(terms, dict):
                            for term_name, term_data in terms.items():
                                # Write term with its definition if available
                                file.write(f"{indent}  {term_name}\n")
                        else:
                            file.write(f"{indent}  {terms}\n")
                else:
                    # If it's a simple term-definition pair
                    file.write(f"{indent}{group_name}\n")
        
        try:
            with open(file_path, "w") as file:
                write_groups(self.groups, file)
            print(f"Saved groups text at depth {self.depth} to {file_path}")
        except Exception as e:
            print(f"Error saving groups text to {file_path}: {str(e)}")