
--- Key Terms ---
This summary covers key concepts in linear programming and related optimization techniques.  The core concept revolves around finding optimal solutions to problems involving linear objective functions and constraints.

* **Slack Variable:** A variable added to a less-than-or-equal-to inequality constraint to convert it into an equality constraint, representing the difference between the constraint's left and right sides.
* **Feasible Region:** The set of all points satisfying all constraints of a linear programming problem.
* **Vertex:** A point where two or more constraint boundaries intersect within the feasible region; in higher dimensions, it's the intersection of multiple constraint hyperplanes.
* **Basic Variable:** In the Simplex method, a variable explicitly expressed in terms of non-basic variables within a dictionary.
* **Non-basic Variable:** In the Simplex method, a variable set to zero in a given iteration.
* **Pivot Operation:** The process of exchanging a basic and non-basic variable in the Simplex method, updating the dictionary to move to a new vertex.
* **Dictionary:** A tabular representation of a linear programming problem where basic variables are functions of non-basic variables, used in the Simplex method to systematically move between vertices.
* **Auxiliary Problem:** A modified linear programming problem used to find an initial feasible solution when the origin is infeasible in the original problem.
* **Largest-Coefficient Rule & Largest-Increase Rule:** Pivot rules in the Simplex method selecting the entering variable based on the largest coefficient in the objective function row or the largest increase in the objective function value, respectively.
* **Klee-Minty Example:** A worst-case scenario for the Simplex method, illustrating its potential exponential time complexity.
* **Bland's Rule & Lexicographic Method:** Pivot rules designed to prevent cycling and ensure termination in the Simplex method.
* **Smoothed Complexity:** A framework analyzing algorithm complexity by averaging performance after small random input perturbations.
* **Interior-Point Method:** A class of linear programming algorithms traversing the interior of the feasible region, unlike the boundary-following Simplex method.
* **Primal Problem:** A linear programming problem in standard maximization form.
* **Dual Problem:** A linear programming problem derived from the primal, typically in minimization form, with relationships defined through matrix transposition and sign changes.
* **Weak Duality:** The objective function value of any feasible primal solution is less than or equal to that of any feasible dual solution.
* **Strong Duality:** If a linear programming problem has an optimal solution, its dual also has an optimal solution, and their optimal objective function values are equal.
* **Complementary Slackness:** For optimal primal and dual solutions, the product of each primal variable and its corresponding dual slack variable (and vice versa) is zero.
* **Negative Transpose Property:** The dual problem's coefficient matrix is the negative transpose of the primal's.
* **Lagrange Multiplier & Lagrangian Function:** A variable and function, respectively, used to incorporate constraints into optimization problems.
* **Standard Form (Linear Programming):** A linear programming problem expressed in a canonical form for efficient solution methods.
* **Augmented Matrix (Simplex Method):** A matrix combining the constraint matrix and an identity matrix to represent constraints using slack variables.
* **Basic Variables (xB) & Non-Basic Variables (xN):** Subsets of variables in a linear programming problem, where basic variables are non-zero and non-basic variables are zero in a given iteration.
* **Simplex Tableau:** A tabular representation of the simplex method's matrix operations.
* **Pivot Operation (Simplex Method):** The process of selecting a pivot element and performing row operations to update the tableau.
* **Complementary Variables (Simplex Method):** Pairs of primal and dual variables with a complementary relationship (one non-zero implies the other is zero).
* **Optimal Solution (Linear Programming):** The solution maximizing (or minimizing) the objective function while satisfying all constraints.
* **Sensitivity Analysis & Parametric Analysis:** Techniques investigating how changes in a linear programming problem's parameters affect the optimal solution.
* **Reduced Costs:** Values indicating the increase in the objective function value if a non-basic variable becomes basic.
* **Range of Optimality & Range of Feasibility:** Ranges of parameter values maintaining the current optimal basis's optimality and feasibility, respectively.
* **Shadow Price:** The rate of change in the optimal objective function value per unit change in a constraint's right-hand side.
* **Dual Simplex Method & Dual Based Phase I Algorithm:** Variants of the simplex method starting with a dual feasible solution or finding an initial dual feasible solution.
* **ξ(x) & ξ(y):** Objective function values for primal and dual problems, respectively.
* **Entering Variable & Leaving Variable:** Variables selected to enter and leave the basis in the simplex method.
* **Elementary Matrix:** A matrix derived from an identity matrix by a single elementary row operation.
* **Farkas Lemma & Fredholm Alternatives:** Theorems providing conditions for the existence or non-existence of solutions to systems of linear inequalities and equations.
* **Integer Programming, Relaxed Problem, Branch-and-Bound, Enumeration Tree, Pruning, Gomory Cuts:** Key concepts and techniques for solving integer programming problems.
* **Network Flow, Nodes, Arcs, bi, Xij, Cij, Balanced Equation, Incidence Matrix, Root Node, Tree Solution, Spanning Tree, Reduced Cost:** Core elements and concepts in network flow problems.
* **Network Simplex Method (Primal and Dual), Primal Flow, Dual Flow, Dual Slack, yi, zij, ỹi, ẑij, μ:**  Elements and concepts specific to the network simplex method.
* **Leaf Node:** A node in a tree with only one edge connected to it.
* **Transportation Problem, Dummy Node, Upper Bounded Transshipment Problem:** Specific types of network flow problems.
* **Shortest Path Problem, Bellman's Equation, Dijkstra's Algorithm:**  Concepts and algorithms for finding shortest paths in graphs.
* **Max Flow, Min Cut, Max-Flow Min-Cut Theorem, Augmenting Path, Ford-Fulkerson Algorithm, Cut Set C, Capacity of a Cut K(C):**  Concepts and algorithms related to maximum flow problems.
* **yi + cij = yj:**  An equation representing the condition for "fair prices" in the network simplex method.
* **Graphical Method:** A visual method for solving small linear programming problems.

This summary provides a comprehensive overview of the key terms, connecting them logically to create a cohesive understanding of the concepts involved.


--- Problem Types ---
This summary outlines the core problem types encountered in linear programming and related optimization techniques.  The problems span foundational concepts, algorithmic approaches, and advanced theoretical considerations.

* **Finding Initial Feasible Solutions:** Linear programming algorithms often require a feasible starting point; techniques exist to find one when the origin is infeasible.
* **Handling Higher-Dimensional Problems:**  The simplex method and other algorithms are adaptable to linear programs with more than two variables, requiring iterative procedures for optimization.
* **Efficient Solution Representation:**  Data structures, such as dictionaries, are employed to represent solutions and facilitate efficient algorithmic operations within the simplex method.
* **Simplex Method Efficiency and Complexity:** The simplex method's worst-case complexity is exponential, but its average-case performance is often polynomial; pivot rule selection significantly impacts efficiency.  Polynomial-time algorithms for linear programming exist, offering an alternative to the simplex method.
* **Duality Theory and Optimality Verification:**  Duality theory establishes relationships between primal and dual linear programs, providing tools for verifying optimality using complementary slackness conditions and analyzing problem feasibility.  The strong duality theorem guarantees equal optimal objective values under certain conditions.
* **Lagrangian Formulation and Duality:** The Lagrangian function is used to incorporate equality and inequality constraints into optimization problems, leading to the derivation of dual problems.
* **Sensitivity Analysis:** This involves determining the impact of changes in objective function coefficients or constraint values on the optimal solution and objective function value.
* **Farkas' Lemma and Feasibility:** Farkas' Lemma provides conditions for the existence or non-existence of solutions to systems of linear inequalities, crucial for analyzing problem feasibility.
* **Integer Programming:** This addresses linear programs with integer variable restrictions, requiring specialized techniques like branch and bound and Gomory cuts for solution.
* **Network Flow Problems:** These involve optimizing flows in networks, often formulated as linear programs.  Specialized algorithms like the network simplex method, along with concepts like spanning trees and the max-flow min-cut theorem, are used for efficient solution.  Various network flow problems, including transportation problems, shortest path problems, and maximum flow problems, are addressed.


--- Algorithm Solutions ---
This summary presents a comprehensive overview of algorithms for solving linear programming (LP) and integer programming (IP) problems, including network flow problems.

* **Simplex Method:** This iterative algorithm solves LPs by moving from one feasible region vertex to another, improving the objective function at each step until optimality is reached.

* **Auxiliary Problem:**  When the origin is infeasible, an auxiliary problem is constructed to find a feasible starting point for the simplex method.

* **Pivot Rules (Largest-Coefficient, Largest-Increase, Bland's, Randomized):** These rules determine which variable enters the basis at each iteration of the simplex method, impacting efficiency and preventing cycling.

* **Duality Theory (Weak Duality, Strong Duality, Complementary Slackness):** These concepts establish relationships between a primal LP problem and its dual, providing optimality conditions and insights into the problem's structure.  Weak duality states that the primal objective function value is always less than or equal to the dual objective function value. Strong duality states that if the primal problem has an optimal solution, then the dual problem also has an optimal solution, and their objective function values are equal. Complementary slackness provides necessary and sufficient conditions for primal and dual feasibility to imply optimality.

* **Lagrangian Function:** This function combines the objective function and constraints of an optimization problem using Lagrange multipliers, forming the basis for duality theory.

* **Primal and Dual Problems (Diet Problem Example):**  The primal problem minimizes cost subject to resource constraints, while the dual problem maximizes resource value subject to cost constraints.

* **Simplex Method in Matrix Form:** This formulation uses matrix operations to efficiently update the objective function and constraints during simplex iterations, leveraging the basis matrix and its inverse.

* **Sensitivity Analysis:** This technique assesses the impact of changes in objective function coefficients or constraint values on the optimal solution, utilizing dual variables (shadow prices).

* **Derivation of the Dual Problem:** The dual problem is derived from the primal problem using Lagrange multipliers, forming a linear combination of the primal constraints.

* **Reformulation of Primal Problem with Unrestricted Variables:**  Unrestricted variables are handled by splitting them into positive and negative parts.

* **Dual Simplex Method:** This algorithm starts with a dual-feasible solution and iteratively improves it until primal feasibility and optimality are achieved.

* **Dual Based Phase I Algorithm:** This algorithm finds an initial dual-feasible solution for the dual simplex method when the origin is infeasible for both primal and dual problems.

* **Farkas Lemma:** This lemma provides a condition for the infeasibility of a system of linear inequalities.

* **Branch and Bound:** This algorithm solves integer programming problems by recursively partitioning the feasible region and solving relaxed linear programs to prune unpromising branches.

* **Gomory Cuts:** This algorithm solves integer programming problems by iteratively adding constraints (Gomory cuts) to eliminate non-integer solutions.

* **Network Flow Problem Formulation:** This problem is formulated as a linear program with flow conservation constraints at each node and non-negativity constraints.

* **Primal and Dual Network Simplex Methods:** These methods adapt the simplex method to network flow problems, efficiently utilizing spanning trees and their properties to update primal and dual variables.

* **Finding a Spanning Tree Basis:** A spanning tree in a network flow problem corresponds to a basis in the constraint matrix, enabling efficient simplex method application.

* **Dual Variable Calculation from Spanning Tree:** Dual variables are calculated iteratively from a root node using the dual flow equation.

* **Bellman's Equation and Dijkstra's Algorithm:** These algorithms are used to solve shortest path problems, a special case of network flow problems.

* **Graphical Method:** This method solves small LPs graphically by plotting constraints and identifying the optimal vertex.

