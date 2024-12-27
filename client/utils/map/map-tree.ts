export type MapNode = {
	id: string
	color?: string
	keyword: string
	description?: string
	children?: MapNode[]
	lectures?: string[]
    visuals?: string[]
    xPosition?: number
    yPosition?: number
    supabaseId?: string
}

export type FlatMapNode = {
	id: string
	keyword: string
	color?: string
	description?: string
	parentId?: string
	lectures?: string[]
    visuals?: string[]
    xPosition?: number
    yPosition?: number
    supabaseId?: string
}

export const CALCULUS_MAP: MapNode = {
	id: '2719fa76-4eff-4d47-b3b1-eb67bdb0fbef',
	keyword: 'Calculus',
	children: [
		{
			id: '5c8f822a-2da0-4668-ac9e-f3af0e2349e9',
			keyword: 'Differential Calculus',
			children: [
				{ id: '4fd2450b-0ca9-4152-9aa6-14f49857f752', keyword: 'Limits' },
				{
					id: 'f9fbf210-f381-472a-a7aa-797c7aee79d3',
					keyword: 'Derivatives',
					children: [
						{
							id: '15382c69-1741-468e-aa0b-a7b5d2c92ae0',
							keyword: 'Chain Rule',
						},
						{
							id: '5e9666fa-8940-42f4-a6f8-6ad2bd84c020',
							keyword: 'Implicit Differentiation',
						},
						{
							id: '7643f401-2202-4b38-a531-24a01a8f791a',
							keyword: 'Partial Differentiation',
						},
					],
				},
				{
					id: '4a407fb2-0a12-4ecc-9412-7c1d3c8bbf90',
					keyword: 'Applications of Derivatives',
					children: [
						{
							id: '1a7571f2-e560-4be5-b6a8-7a36aae6f9c0',
							keyword: 'Optimization',
						},
						{
							id: 'ea6ef694-9d96-446d-b07c-651e6693f31c',
							keyword: 'Related Rates',
						},
						{
							id: '9268381a-f32c-4f13-a1c9-0a672c9922d3',
							keyword: 'Tangent Lines',
						},
						{
							id: '1251bf8e-de6b-47d4-a4f2-98e0be8374dd',
							keyword: "L'Hôpital's Rule",
						},
					],
				},
			],
		},
		{
			id: 'd6fa84e7-0feb-4374-a75f-3279e8e9e130',
			keyword: 'Integral Calculus',
			children: [
				{
					id: '6e9a5e2f-5f92-4887-884f-6aefef984fba',
					keyword: 'Antiderivatives',
				},
				{
					id: 'dab533ca-9890-4f7a-bbd2-798d7bc9e575',
					keyword: 'Definite Integrals',
					children: [
						{
							id: '8dfe80cf-7f93-4aa7-9d2f-300f105c2062',
							keyword: 'Fundamental Theorem of Calculus',
						},
						{
							id: '57eadaf4-b87f-4705-b75c-5ff1bce7248b',
							keyword: 'Area between Curves',
						},
					],
				},
				{
					id: 'b4d7721a-ab51-43e1-ab41-92606702e7e4',
					keyword: 'Applications of Integrals',
					children: [
						{
							id: '31009d88-adfb-4bf8-8463-09a79562ecf1',
							keyword: 'Area under Curves',
						},
						{
							id: '0cfca44d-5287-4f53-acb8-fac07d982820',
							keyword: 'Volume of Solids',
						},
						{
							id: 'bc956180-45f1-4c20-8435-3fd0d6b1446b',
							keyword: 'Work and Accumulation',
						},
						{
							id: 'd05dd4a5-d290-4bb3-8e95-a27a2f5d7e12',
							keyword: 'Arc Length',
						},
					],
				},
			],
		},
		{
			id: 'a6f041eb-4248-42bc-a2d8-e1e6e107de3e',
			keyword: 'Multivariable Calculus',
			children: [
				{
					id: 'dcafd4b1-6118-4627-adef-3f813f9971f0',
					keyword: 'Partial Derivatives',
				},
				{
					id: '8bfc0253-eeeb-4c29-b1fc-b04c2774350b',
					keyword: 'Multiple Integrals',
					children: [
						{
							id: 'c8e5c08c-2560-4476-99d0-98034b03b2d7',
							keyword: 'Double Integrals',
						},
						{
							id: '3268fb24-7eb8-4144-ae99-cb86e4900803',
							keyword: 'Triple Integrals',
						},
					],
				},
				{
					id: '083ce928-786a-4fd2-be51-833485a22011',
					keyword: 'Vector Calculus',
					children: [
						{ id: '5d12a153-dc81-416d-8f78-51b563560e58', keyword: 'Gradient' },
						{
							id: '3a24f270-fda0-46b3-8b1a-b4ca926da74b',
							keyword: 'Divergence',
						},
						{ id: 'b5b3dc09-058d-47ff-9b36-4e945b23921d', keyword: 'Curl' },
						{
							id: '656078e4-6cd5-44b5-be18-b72aae94aa17',
							keyword: "Stokes' Theorem",
						},
						{
							id: 'ef615a83-5bd2-4b25-be6a-a179a83fd670',
							keyword: "Green's Theorem",
						},
					],
				},
			],
		},
		{
			id: '905c39fb-08c9-4686-bb64-88e953469082',
			keyword: 'Sequences and Series',
			children: [
				{
					id: '1683999f-0add-482c-9432-b2bf2cf2e2e5',
					keyword: 'Convergence and Divergence',
				},
				{
					id: '5929c0ef-1b33-4332-b383-1e36ecca7cc7',
					keyword: 'Taylor Series',
				},
				{ id: '6534eaea-d341-4dc8-8e8f-4beaaf93fa5a', keyword: 'Power Series' },
			],
		},
		{
			id: '4d5763cb-6c4e-4d9c-8c1d-e7c698126d96',
			keyword: 'Differential Equations',
			children: [
				{
					id: '66801463-05de-428b-a8eb-18e2ded3794b',
					keyword: 'First-Order Differential Equations',
				},
				{
					id: '6486f3f1-186d-4f00-ae12-bc642276da28',
					keyword: 'Second-Order Differential Equations',
				},
				{
					id: '5ff75655-f3ec-4119-ad38-ceb9eebedc8f',
					keyword: 'Systems of Differential Equations',
				},
				{
					id: '518c8677-5681-492b-b61d-34439ac87af2',
					keyword: 'Boundary Value Problems',
				},
			],
		},
	],
}

export const LP_MAP_CHAT_V3 = {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "keyword": "Linear Programming",
    "description": "Linear programming is a mathematical method for achieving the best outcome in a model whose requirements are represented by linear relationships.",
    "lectures": ["99c85304-93a7-4d4e-a1fd-931f219ae490"],
    "children": [
        {
            "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
            "keyword": "Fundamental Methods",
            "description": "Core methods and concepts in linear programming, including the Simplex Method, Dual Simplex Method, and matrix representations.",
            "lectures": [
                "53a2414d-8647-4238-b29b-c8d829f01956",
                "d4750711-22f1-4639-8ab6-1e2393e88f68",
                "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3",
                "4bcb992c-ced5-454f-83c0-9478e6183b62"
            ],
            "children": [
                {
                    "id": "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
                    "keyword": "Simplex Method",
                    "description": "An iterative algorithm used to solve linear programming problems by systematically evaluating vertices of the feasible region.",
                    "lectures": [
                        "53a2414d-8647-4238-b29b-c8d829f01956",
                        "d4750711-22f1-4639-8ab6-1e2393e88f68",
                        "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3",
                        "4bcb992c-ced5-454f-83c0-9478e6183b62"
                    ],
                    "children": [
                        {
                            "id": "4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a",
                            "keyword": "Graphical Representation of Constraints",
                            "description": "Visual depiction of constraints by plotting the feasible region that satisfies all constraints.",
                            "lectures": ["53a2414d-8647-4238-b29b-c8d829f01956"],
                            "children": []
                        },
                        {
                            "id": "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
                            "keyword": "Feasible Region and Vertices",
                            "description": "The feasible region is the set of all possible solutions satisfying all constraints; vertices represent critical points for finding the optimal solution.",
                            "lectures": ["53a2414d-8647-4238-b29b-c8d829f01956"],
                            "children": []
                        },
                        {
                            "id": "6f7a8b9c-0d1e-2f3a-4b5c-6d7e8f9a0b1c",
                            "keyword": "Simplex Method Efficiency",
                            "description": "Analyzing the performance of the Simplex method in average and worst-case scenarios.",
                            "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                            "children": [
                                {
                                    "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
                                    "keyword": "Average-Case Performance",
                                    "description": "Evaluating the typical number of iterations required for different problem sizes.",
                                    "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                                    "children": []
                                },
                                {
                                    "id": "8b9c0d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e",
                                    "keyword": "Worst-Case Scenarios",
                                    "description": "Exploring theoretical limitations of the algorithm in specific situations.",
                                    "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "9c0d1e2f-3a4b-5c6d-7e8f-9a0b1c2d3e4f",
                            "keyword": "Simplex Matrix",
                            "description": "Matrix representation of LP problems used in the Simplex algorithm's iterative process.",
                            "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                            "children": [
                                {
                                    "id": "0d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5g",
                                    "keyword": "Matrix Representation of LP Problems",
                                    "description": "Using matrices to represent constraints and objective functions.",
                                    "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                                    "children": []
                                },
                                {
                                    "id": "1e2f3a4b-5c6d-7e8f-9a0b-1c2d3e4f5g6h",
                                    "keyword": "Simplex Algorithm Iterations",
                                    "description": "Step-by-step process of modifying the matrix to find the optimal solution.",
                                    "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "2f3a4b5c-6d7e-8f9a-0b1c-2d3e4f5g6h7i",
                            "keyword": "Dual Simplex Method",
                            "description": "A variation of the Simplex Method used when the initial solution is not feasible but the dual problem is.",
                            "lectures": ["4bcb992c-ced5-454f-83c0-9478e6183b62"],
                            "children": [
                                {
                                    "id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5g6h7i8j",
                                    "keyword": "Simplex Method Variations",
                                    "description": "Variations like the Dual Simplex Method and Phase I Algorithm used in specific scenarios.",
                                    "lectures": ["4bcb992c-ced5-454f-83c0-9478e6183b62"],
                                    "children": []
                                }
                            ]
                        }
                    ]
                }
            ],
        },
        {
                "id": "423e4567-e89b-12d3-a456-42661417400d",
                "keyword": "Duality and Theoretical Foundations",
                "description": "Exploring the duality principles and theoretical underpinnings of linear programming.",
                "lectures": [
                    "df805eda-39bb-4147-b9da-ade25bb4908d",
                    "0eec1a18-09b9-41d4-8d83-d346669cd75e",
                    "b1f987e0-f002-4932-b835-3ad3ade23b22",
                    "b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"
                ],
                "children": [
                    {
                        "id": "523e4567-e89b-12d3-a456-42661417400e",
                        "keyword": "Duality in Linear Programming",
                        "description": "Every linear programming problem has a corresponding dual problem; solving one provides insights into the other.",
                        "lectures": [
                            "df805eda-39bb-4147-b9da-ade25bb4908d",
                            "0eec1a18-09b9-41d4-8d83-d346669cd75e",
                            "f9f4f8f5-b140-4c60-b3d9-05c422f461f0",
                            "dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"
                        ],
                        "children": [
                            {
                                "id": "623e4567-e89b-12d3-a456-42661417400f",
                                "keyword": "Primal and Dual Problems",
                                "description": "Pairs of LP problems where one is the original and the other has a reversed objective function and constraints.",
                                "lectures": ["df805eda-39bb-4147-b9da-ade25bb4908d"],
                                "children": []
                            },
                            {
                                "id": "723e4567-e89b-12d3-a456-426614174010",
                                "keyword": "Complementary Slackness",
                                "description": "A theorem relating primal and dual variables at optimality.",
                                "lectures": ["df805eda-39bb-4147-b9da-ade25bb4908d"],
                                "children": []
                            },
                            {
                                "id": "823e4567-e89b-12d3-a456-426614174011",
                                "keyword": "General Duality",
                                "description": "Establishing correspondence between a primal problem and its dual, where solving one solves the other.",
                                "lectures": ["0eec1a18-09b9-41d4-8d83-d346669cd75e"],
                                "children": [
                                    {
                                        "id": "923e4567-e89b-12d3-a456-426614174012",
                                        "keyword": "Applications of Duality",
                                        "description": "Real-world applications like resource allocation and supply chain management.",
                                        "lectures": ["0eec1a18-09b9-41d4-8d83-d346669cd75e"],
                                        "children": []
                                    }
                                ]
                            },
                            {
                                "id": "a23e4567-e89b-12d3-a456-426614174013",
                                "keyword": "Duality Examples",
                                "description": "Examples highlighting the connection between minimization and maximization problems.",
                                "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                                "children": [
                                    {
                                        "id": "b23e4567-e89b-12d3-a456-426614174014",
                                        "keyword": "Diet Problem",
                                        "description": "Determining the optimal mix of foods to meet dietary needs at the lowest cost.",
                                        "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                                        "children": []
                                    },
                                    {
                                        "id": "c23e4567-e89b-12d3-a456-426614174015",
                                        "keyword": "Dual Relationship",
                                        "description": "Connecting minimization problems to their corresponding maximization problems.",
                                        "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                                        "children": []
                                    }
                                ]
                            },
                            {
                                "id": "d23e4567-e89b-12d3-a456-426614174016",
                                "keyword": "Duality Sensitivity Analysis",
                                "description": "Analyzing how changes in constraints affect the optimal solution, focusing on primal-dual relationships.",
                                "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                                "children": [
                                    {
                                        "id": "e23e4567-e89b-12d3-a456-426614174017",
                                        "keyword": "Primal-Dual Relationship",
                                        "description": "Fundamental connection between a maximization and its corresponding minimization problem.",
                                        "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                                        "children": []
                                    },
                                    {
                                        "id": "f23e4567-e89b-12d3-a456-426614174018",
                                        "keyword": "Sensitivity Analysis Techniques",
                                        "description": "Methods to evaluate the impact of changes in constraints or coefficients.",
                                        "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                                        "children": []
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "id": "523e4567-e89b-12d3-a456-426614174019",
                        "keyword": "Convex Analysis and Farkas Lemma",
                        "description": "Studying convex sets and the Farkas Lemma, foundational for solving optimization problems.",
                        "lectures": [
                            "b1f987e0-f002-4932-b835-3ad3ade23b22",
                            "b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"
                        ],
                        "children": [
                            {
                                "id": "623e4567-e89b-12d3-a456-42661417401a",
                                "keyword": "Convex Analysis",
                                "description": "Studies convex sets, combinations, hulls, and separation theorems.",
                                "lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
                                "children": [
                                    {
                                        "id": "723e4567-e89b-12d3-a456-42661417401b",
                                        "keyword": "Convex Sets & Combinations",
                                        "description": "Defines convex sets and their relationships with contained points.",
                                        "lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
                                        "children": []
                                    },
                                    {
                                        "id": "823e4567-e89b-12d3-a456-42661417401c",
                                        "keyword": "Separation Theorems & Convex Hulls",
                                        "description": "Tools for analyzing and solving optimization problems involving convex sets.",
                                        "lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
                                        "children": []
                                    }
                                ]
                            },
                            {
                                "id": "923e4567-e89b-12d3-a456-42661417401d",
                                "keyword": "Farkas Lemma",
                                "description": "Establishes a relationship between the solvability of a system of linear inequalities and the existence of a particular solution.",
                                "lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
                                "children": [
                                    {
                                        "id": "a23e4567-e89b-12d3-a456-42661417401e",
                                        "keyword": "Feasibility",
                                        "description": "Condition where a non-negative solution exists to satisfy the inequalities.",
                                        "lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
                                        "children": []
                                    },
                                    {
                                        "id": "b23e4567-e89b-12d3-a456-42661417401f",
                                        "keyword": "Infeasibility",
                                        "description": "Condition indicating the original system is not solvable.",
                                        "lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
                                        "children": []
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "id": "623e4567-e89b-12d3-a456-426614174020",
                "keyword": "Applications and Advanced Topics",
                "description": "Practical applications and advanced concepts in linear programming, including sensitivity analysis, integer programming, network flow, and regression.",
                "lectures": [
                    "9c83bfa8-d773-4ace-b84a-21f7d814b33c",
                    "866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81",
                    "6a3bce7c-84d0-438b-8428-c5a79d404f85",
                    "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
                    "f242d8c5-a635-4384-b3bb-ed7a94a9b980",
                    "fb8a8493-d3e8-4197-81dd-fd398b8080fb"
                ],
                "children": [
                    {
                        "id": "723e4567-e89b-12d3-a456-426614174021",
                        "keyword": "Sensitivity and Parametric Analysis",
                        "description": "Determining how changes in input data affect the optimal solution through sensitivity and parametric analysis.",
                        "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                        "children": [
                            {
                                "id": "823e4567-e89b-12d3-a456-426614174022",
                                "keyword": "Sensitivity Analysis",
                                "description": "Analyzing the impact of parameter changes on the optimal solution.",
                                "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                                "children": [
                                    {
                                        "id": "923e4567-e89b-12d3-a456-426614174023",
                                        "keyword": "Impact of Parameter Changes",
                                        "description": "Examining how changes in coefficients or RHS affect the solution.",
                                        "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                                        "children": []
                                    },
                                    {
                                        "id": "a23e4567-e89b-12d3-a456-426614174024",
                                        "keyword": "Optimal Solution Stability",
                                        "description": "Evaluating the robustness of the optimal solution to small changes.",
                                        "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                                        "children": []
                                    }
                                ]
                            },
                            {
                                "id": "b23e4567-e89b-12d3-a456-426614174025",
                                "keyword": "Parametric Analysis",
                                "description": "Exploring how the optimal solution shifts as parameters vary over a range.",
                                "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                                "children": [
                                    {
                                        "id": "c23e4567-e89b-12d3-a456-426614174026",
                                        "keyword": "Objective Function Parameter Variations",
                                        "description": "Examining the impact of changes in objective function parameters.",
                                        "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                                        "children": []
                                    },
                                    {
                                        "id": "d23e4567-e89b-12d3-a456-426614174027",
                                        "keyword": "Constraint Parameter Variations",
                                        "description": "Evaluating how changes in constraints alter the optimal solution.",
                                        "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                                        "children": []
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "id": "823e4567-e89b-12d3-a456-426614174028",
                        "keyword": "Integer Programming",
                        "description": "Optimization problems where some or all variables must be integer values.",
                        "lectures": [
                            "866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81",
                            "6a3bce7c-84d0-438b-8428-c5a79d404f85"
                        ],
                        "children": [
                            {
                                "id": "923e4567-e89b-12d3-a456-426614174029",
                                "keyword": "Integer Programming Methods",
                                "description": "Methods for solving integer programming problems.",
                                "lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
                                "children": [
                                    {
                                        "id": "a23e4567-e89b-12d3-a456-42661417402a",
                                        "keyword": "Branch-and-Bound Method",
                                        "description": "Systematically explores solution space by creating subproblems and bounding them.",
                                        "lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
                                        "children": []
                                    },
                                    {
                                        "id": "b23e4567-e89b-12d3-a456-42661417402b",
                                        "keyword": "Gomory Cuts",
                                        "description": "Technique used to refine feasible region and force integer solutions.",
                                        "lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
                                        "children": []
                                    }
                                ]
                            },
                            {
                                "id": "c23e4567-e89b-12d3-a456-42661417402c",
                                "keyword": "Integer Programming Examples",
                                "description": "Applications requiring integer solutions in areas like scheduling and resource allocation.",
                                "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                                "children": [
                                    {
                                        "id": "d23e4567-e89b-12d3-a456-42661417402d",
                                        "keyword": "Maximum Weight Matching",
                                        "description": "Optimizing the assignment of tasks or resources for best outcome.",
                                        "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                                        "children": []
                                    },
                                    {
                                        "id": "e23e4567-e89b-12d3-a456-42661417402e",
                                        "keyword": "Machine Scheduling and Knapsack Problems",
                                        "description": "Scheduling tasks and optimizing resource allocation in constrained scenarios.",
                                        "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                                        "children": []
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "id": "923e4567-e89b-12d3-a456-42661417402f",
                        "keyword": "Network Flow",
                        "description": "Optimizing movement through networks of interconnected points.",
                        "lectures": [
                            "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
                            "f242d8c5-a635-4384-b3bb-ed7a94a9b980",
                            "0ce8c393-2665-4132-ae76-5b409dc704e6"
                        ],
                        "children": [
                            {
                                "id": "a23e4567-e89b-12d3-a456-426614174030",
                                "keyword": "Formulation as a Linear Program",
                                "description": "Expressing network flow problems as optimization problems with linear objectives and constraints.",
                                "lectures": ["b07f46a7-cbf0-41b4-823a-4e8374f61b01"],
                                "children": []
                            },
                            {
                                "id": "b23e4567-e89b-12d3-a456-426614174031",
                                "keyword": "Spanning Trees and Optimality",
                                "description": "Spanning trees serve as starting points for optimization algorithms.",
                                "lectures": [
                                    "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
                                    "0ce8c393-2665-4132-ae76-5b409dc704e6"
                                ],
                                "children": [
                                    {
                                        "id": "c23e4567-e89b-12d3-a456-426614174032",
                                        "keyword": "Network Simplex Method",
                                        "description": "Specialized algorithm leveraging spanning trees to optimize flow.",
                                        "lectures": ["0ce8c393-2665-4132-ae76-5b409dc704e6"],
                                        "children": [
                                            {
                                                "id": "d23e4567-e89b-12d3-a456-426614174033",
                                                "keyword": "Spanning Tree Optimization",
                                                "description": "Using spanning trees for efficiently optimizing flows.",
                                                "lectures": ["0ce8c393-2665-4132-ae76-5b409dc704e6"],
                                                "children": []
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                "id": "c23e4567-e89b-12d3-a456-426614174034",
                                "keyword": "Network Applications",
                                "description": "Optimizing resource flow through networks, including transportation and shortest paths.",
                                "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                                "children": [
                                    {
                                        "id": "d23e4567-e89b-12d3-a456-426614174035",
                                        "keyword": "Transportation Problems",
                                        "description": "Minimizing cost of transporting resources from origins to destinations.",
                                        "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                                        "children": []
                                    },
                                    {
                                        "id": "e23e4567-e89b-12d3-a456-426614174036",
                                        "keyword": "Shortest Path Problems",
                                        "description": "Finding optimal routes between two points in a network.",
                                        "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                                        "children": []
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "id": "d23e4567-e89b-12d3-a456-426614174037",
                        "keyword": "Linear Regression",
                        "description": "Modeling the relationship between dependent and independent variables.",
                        "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                        "children": [
                            {
                                "id": "e23e4567-e89b-12d3-a456-426614174038",
                                "keyword": "Regression Techniques",
                                "description": "Methods of calculating estimates for a regression line.",
                                "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                                "children": []
                            },
                            {
                                "id": "f23e4567-e89b-12d3-a456-426614174039",
                                "keyword": "Linear Models",
                                "description": "Using linear equations to find best-fit coefficients.",
                                "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                                "children": []
                            }
                        ]
                    }
                ]
            }
        ]
    }




export const LP_MAP_CHAT_V2 = {
    "id": "a1f3e5c6-7b8d-4e9f-a0b1-c2d3e4f5a6b7",
    "keyword": "Linear Programming",
    "description": "Linear programming is a mathematical method for achieving the best outcome in a model whose requirements are represented by linear relationships.",
    "lectures": ["99c85304-93a7-4d4e-a1fd-931f219ae490"],
    "children": [
        {
            "id": "b2c4d6e8-9f0a-1b2c-3d4e-5f6a7b8c9d0e",
            "keyword": "Fundamental Concepts and Methods",
            "description": "Core methods and concepts in linear programming, including the Simplex Method, Duality, and Convex Analysis.",
            "lectures": [
                "53a2414d-8647-4238-b29b-c8d829f01956",
                "d4750711-22f1-4639-8ab6-1e2393e88f68",
                "df805eda-39bb-4147-b9da-ade25bb4908d",
                "0eec1a18-09b9-41d4-8d83-d346669cd75e",
                "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3",
                "b1f987e0-f002-4932-b835-3ad3ade23b22",
                "b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96",
                "4bcb992c-ced5-454f-83c0-9478e6183b62",
                "f9f4f8f5-b140-4c60-b3d9-05c422f461f0",
                "dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"
            ],
            "children": [
                {
                    "id": "c3d5e7f9-0a1b-2c3d-4e5f-6a7b8c9d0e1f",
                    "keyword": "Simplex Method",
                    "description": "An iterative algorithm used to solve linear programming problems by systematically evaluating vertices of the feasible region.",
                    "lectures": [
                        "53a2414d-8647-4238-b29b-c8d829f01956",
                        "d4750711-22f1-4639-8ab6-1e2393e88f68",
                        "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3",
                        "4bcb992c-ced5-454f-83c0-9478e6183b62"
                    ],
                    "children": [
                        {
                            "id": "d4e6f8a0-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
                            "keyword": "Graphical Representation of Constraints",
                            "description": "Visual depiction of constraints by plotting the feasible region that satisfies all constraints.",
                            "lectures": ["53a2414d-8647-4238-b29b-c8d829f01956"],
                            "children": []
                        },
                        {
                            "id": "e5f7a9b1-2c3d-4e5f-6a7b-8c9d0e1f2a3b",
                            "keyword": "Feasible Region and Vertices",
                            "description": "The feasible region is the set of all possible solutions satisfying all constraints; vertices represent critical points for finding the optimal solution.",
                            "lectures": ["53a2414d-8647-4238-b29b-c8d829f01956"],
                            "children": []
                        },
                        {
                            "id": "f6a8b0c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
                            "keyword": "Simplex Method Efficiency",
                            "description": "Analyzing the performance of the Simplex method in average and worst-case scenarios.",
                            "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                            "children": [
                                {
                                    "id": "a7b9c1d3-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
                                    "keyword": "Average-Case Performance",
                                    "description": "Evaluating the typical number of iterations required for different problem sizes.",
                                    "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                                    "children": []
                                },
                                {
                                    "id": "b8c0d2e4-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
                                    "keyword": "Worst-Case Scenarios",
                                    "description": "Exploring theoretical limitations of the algorithm in specific situations.",
                                    "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "c9d1e3f5-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
                            "keyword": "Simplex Matrix",
                            "description": "Matrix representation of LP problems used in the Simplex algorithm's iterative process.",
                            "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                            "children": [
                                {
                                    "id": "d0e2f4a6-7b8c-9d0e-1f2a-3b4c5d6e7f8a",
                                    "keyword": "Matrix Representation of LP Problems",
                                    "description": "Using matrices to represent constraints and objective functions.",
                                    "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                                    "children": []
                                },
                                {
                                    "id": "e1f3a5b7-8c9d-0e1f-2a3b-4c5d6e7f8a9b",
                                    "keyword": "Simplex Algorithm Iterations",
                                    "description": "Step-by-step process of modifying the matrix to find the optimal solution.",
                                    "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "f2a4b6c8-9d0e-1f2a-3b4c-5d6e7f8a9b0c",
                            "keyword": "Dual Simplex Method",
                            "description": "A variation of the Simplex Method used when the initial solution is not feasible but the dual problem is.",
                            "lectures": ["4bcb992c-ced5-454f-83c0-9478e6183b62"],
                            "children": [
                                {
                                    "id": "a3b5c7d9-0e1f-2a3b-4c5d-6e7f8a9b0c1d",
                                    "keyword": "Simplex Method Variations",
                                    "description": "Variations like the Dual Simplex Method and Phase I Algorithm used in specific scenarios.",
                                    "lectures": ["4bcb992c-ced5-454f-83c0-9478e6183b62"],
                                    "children": []
                                }
                            ]
                        }
                    ]
                },
                {
                    "id": "b4c6d8e0-1f2a-3b4c-5d6e-7f8a9b0c1d2e",
                    "keyword": "Duality in Linear Programming",
                    "description": "Every linear programming problem has a corresponding dual problem; solving one provides insights into the other.",
                    "lectures": [
                        "df805eda-39bb-4147-b9da-ade25bb4908d",
                        "0eec1a18-09b9-41d4-8d83-d346669cd75e",
                        "f9f4f8f5-b140-4c60-b3d9-05c422f461f0",
                        "dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"
                    ],
                    "children": [
                        {
                            "id": "c5d7e9f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f",
                            "keyword": "Primal and Dual Problems",
                            "description": "Pairs of LP problems where one is the original and the other has a reversed objective function and constraints.",
                            "lectures": ["df805eda-39bb-4147-b9da-ade25bb4908d"],
                            "children": []
                        },
                        {
                            "id": "d6e8f0a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a",
                            "keyword": "Complementary Slackness",
                            "description": "A theorem relating primal and dual variables at optimality.",
                            "lectures": ["df805eda-39bb-4147-b9da-ade25bb4908d"],
                            "children": []
                        },
                        {
                            "id": "e7f9a1b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
                            "keyword": "General Duality",
                            "description": "Establishing correspondence between a primal problem and its dual, where solving one solves the other.",
                            "lectures": ["0eec1a18-09b9-41d4-8d83-d346669cd75e"],
                            "children": [
                                {
                                    "id": "f8a0b2c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
                                    "keyword": "Applications of Duality",
                                    "description": "Real-world applications like resource allocation and supply chain management.",
                                    "lectures": ["0eec1a18-09b9-41d4-8d83-d346669cd75e"],
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "a9b1c3d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d",
                            "keyword": "Duality Examples",
                            "description": "Examples highlighting the connection between minimization and maximization problems.",
                            "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                            "children": [
                                {
                                    "id": "b0c2d4e6-7f8a-9b0c-1d2e-3f4a5b6c7d8e",
                                    "keyword": "Diet Problem",
                                    "description": "Determining the optimal mix of foods to meet dietary needs at the lowest cost.",
                                    "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                                    "children": []
                                },
                                {
                                    "id": "c1d3e5f7-8a9b-0c1d-2e3f-4a5b6c7d8e9f",
                                    "keyword": "Dual Relationship",
                                    "description": "Connecting minimization problems to their corresponding maximization problems.",
                                    "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "d2e4f6a8-9b0c-1d2e-3f4a-5b6c7d8e9f0a",
                            "keyword": "Duality Sensitivity Analysis",
                            "description": "Analyzing how changes in constraints affect the optimal solution, focusing on primal-dual relationships.",
                            "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                            "children": [
                                {
                                    "id": "e3f5a7b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b",
                                    "keyword": "Primal-Dual Relationship",
                                    "description": "Fundamental connection between a maximization and its corresponding minimization problem.",
                                    "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                                    "children": []
                                },
                                {
                                    "id": "f4a6b8c0-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
                                    "keyword": "Sensitivity Analysis Techniques",
                                    "description": "Methods to evaluate the impact of changes in constraints or coefficients.",
                                    "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                                    "children": []
                                }
                            ]
                        }
                    ]
                },
                {
                    "id": "e5f7a9c1-2e3f-4a5b-6c7d-8e9f0a1b2c3d",
                    "keyword": "Convex Analysis and Farkas Lemma",
                    "description": "Studying convex sets and the Farkas Lemma, foundational for solving optimization problems.",
                    "lectures": [
                        "b1f987e0-f002-4932-b835-3ad3ade23b22",
                        "b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"
                    ],
                    "children": [
                        {
                            "id": "f6a8b0d2-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
                            "keyword": "Convex Analysis",
                            "description": "Studies convex sets, combinations, hulls, and separation theorems.",
                            "lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
                            "children": [
                                {
                                    "id": "a7b9c1e3-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
                                    "keyword": "Convex Sets & Combinations",
                                    "description": "Defines convex sets and their relationships with contained points.",
                                    "lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
                                    "children": []
                                },
                                {
                                    "id": "b8c0d2f4-5b6c-7d8e-9f0a-1b2c3d4e5f6a",
                                    "keyword": "Separation Theorems & Convex Hulls",
                                    "description": "Tools for analyzing and solving optimization problems involving convex sets.",
                                    "lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
                                    "children": []
                                }
                            ]
                        },
                        {
                            "id": "c9d1e3a5-6c7d-8e9f-0a1b-2c3d4e5f6a7b",
                            "keyword": "Farkas Lemma",
                            "description": "Establishes a relationship between the solvability of a system of linear inequalities and the existence of a particular solution.",
                            "lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
                            "children": [
                                {
                                    "id": "d0e2f4b6-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
                                    "keyword": "Feasibility",
                                    "description": "Condition where a non-negative solution exists to satisfy the inequalities.",
                                    "lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
                                    "children": []
                                },
                                {
                                    "id": "e1f3a5c7-8e9f-0a1b-2c3d-4e5f6a7b8c9d",
                                    "keyword": "Infeasibility",
                                    "description": "Condition indicating the original system is not solvable.",
                                    "lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
                                    "children": []
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "f7a9c1d3-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
            "keyword": "Sensitivity and Parametric Analysis",
            "description": "Determining how changes in input data affect the optimal solution.",
            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
            "children": [
                {
                    "id": "a8b0c2d4-5b6c-7d8e-9f0a-1b2c3d4e5f6a",
                    "keyword": "Sensitivity Analysis",
                    "description": "Analyzing the impact of parameter changes on the optimal solution.",
                    "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                    "children": [
                        {
                            "id": "b9c1d3e5-6c7d-8e9f-0a1b-2c3d4e5f6a7b",
                            "keyword": "Impact of Parameter Changes",
                            "description": "Examining how changes in coefficients or RHS affect the solution.",
                            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                            "children": []
                        },
                        {
                            "id": "c0d2e4f6-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
                            "keyword": "Optimal Solution Stability",
                            "description": "Evaluating the robustness of the optimal solution to small changes.",
                            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "d1e3f5a7-8e9f-0a1b-2c3d-4e5f6a7b8c9d",
                    "keyword": "Parametric Analysis",
                    "description": "Exploring how the optimal solution shifts as parameters vary over a range.",
                    "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                    "children": [
                        {
                            "id": "e2f4a6b8-9f0a-1b2c-3d4e-5f6a7b8c9d0e",
                            "keyword": "Objective Function Parameter Variations",
                            "description": "Examining the impact of changes in objective function parameters.",
                            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                            "children": []
                        },
                        {
                            "id": "f3a5b7c9-0a1b-2c3d-4e5f-6a7b8c9d0e1f",
                            "keyword": "Constraint Parameter Variations",
                            "description": "Evaluating how changes in constraints alter the optimal solution.",
                            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "a9c1d3e5-6c7d-8e9f-0a1b-2c3d4e5f6a7b",
            "keyword": "Integer Programming",
            "description": "Optimization problems where some or all variables must be integer values.",
            "lectures": [
                "866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81",
                "6a3bce7c-84d0-438b-8428-c5a79d404f85"
            ],
            "children": [
                {
                    "id": "b0d2e4f6-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
                    "keyword": "Integer Programming Methods",
                    "description": "Methods for solving integer programming problems.",
                    "lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
                    "children": [
                        {
                            "id": "c1e3f5a7-8e9f-0a1b-2c3d-4e5f6a7b8c9d",
                            "keyword": "Branch-and-Bound Method",
                            "description": "Systematically explores solution space by creating subproblems and bounding them.",
                            "lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
                            "children": []
                        },
                        {
                            "id": "d2f4a6b8-9f0a-1b2c-3d4e-5f6a7b8c9d0e",
                            "keyword": "Gomory Cuts",
                            "description": "Technique used to refine feasible region and force integer solutions.",
                            "lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "e3a5b7c9-0a1b-2c3d-4e5f-6a7b8c9d0e1f",
                    "keyword": "Integer Programming Examples",
                    "description": "Applications requiring integer solutions in areas like scheduling and resource allocation.",
                    "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                    "children": [
                        {
                            "id": "f4b6c8d0-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
                            "keyword": "Maximum Weight Matching",
                            "description": "Optimizing the assignment of tasks or resources for best outcome.",
                            "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                            "children": []
                        },
                        {
                            "id": "a5c7d9e1-2c3d-4e5f-6a7b-8c9d0e1f2a3b",
                            "keyword": "Machine Scheduling and Knapsack Problems",
                            "description": "Scheduling tasks and optimizing resource allocation in constrained scenarios.",
                            "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "b6d8e0f2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
            "keyword": "Network Flow",
            "description": "Optimizing movement through networks of interconnected points.",
            "lectures": [
                "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
                "f242d8c5-a635-4384-b3bb-ed7a94a9b980",
                "0ce8c393-2665-4132-ae76-5b409dc704e6"
            ],
            "children": [
                {
                    "id": "c7e9f1a3-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
                    "keyword": "Formulation as a Linear Program",
                    "description": "Expressing network flow problems as optimization problems with linear objectives and constraints.",
                    "lectures": ["b07f46a7-cbf0-41b4-823a-4e8374f61b01"],
                    "children": []
                },
                {
                    "id": "d8f0a2b4-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
                    "keyword": "Spanning Trees and Optimality",
                    "description": "Spanning trees serve as starting points for optimization algorithms.",
                    "lectures": [
                        "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
                        "0ce8c393-2665-4132-ae76-5b409dc704e6"
                    ],
                    "children": [
                        {
                            "id": "e9a1b3c5-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
                            "keyword": "Network Simplex Method",
                            "description": "Specialized algorithm leveraging spanning trees to optimize flow.",
                            "lectures": ["0ce8c393-2665-4132-ae76-5b409dc704e6"],
                            "children": [
                                {
                                    "id": "f0b2c4d6-7b8c-9d0e-1f2a-3b4c5d6e7f8a",
                                    "keyword": "Spanning Tree Optimization",
                                    "description": "Using spanning trees for efficiently optimizing flows.",
                                    "lectures": ["0ce8c393-2665-4132-ae76-5b409dc704e6"],
                                    "children": []
                                }
                            ]
                        }
                    ]
                },
                {
                    "id": "a1c3d5e7-8c9d-0e1f-2a3b-4c5d6e7f8a9b",
                    "keyword": "Network Applications",
                    "description": "Optimizing resource flow through networks, including transportation and shortest paths.",
                    "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                    "children": [
                        {
                            "id": "b2d4e6f8-9d0e-1f2a-3b4c-5d6e7f8a9b0c",
                            "keyword": "Transportation Problems",
                            "description": "Minimizing cost of transporting resources from origins to destinations.",
                            "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                            "children": []
                        },
                        {
                            "id": "c3e5f7a9-0e1f-2a3b-4c5d-6e7f8a9b0c1d",
                            "keyword": "Shortest Path Problems",
                            "description": "Finding optimal routes between two points in a network.",
                            "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "d4f6a8b0-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
            "keyword": "Applications of Linear Programming",
            "description": "Practical applications including production planning, portfolio optimization, regression, and classification.",
            "lectures": [
                "6a3bce7c-84d0-438b-8428-c5a79d404f85",
                "fb8a8493-d3e8-4197-81dd-fd398b8080fb"
            ],
            "children": [
                {
                    "id": "e5a7c9d1-6e7f-8a9b-0c1d-2e3f4a5b6c7d",
                    "keyword": "Production Planning",
                    "description": "Optimizing production levels to meet demand while considering costs.",
                    "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                    "children": []
                },
                {
                    "id": "f6b8d0e2-7f8a-9b0c-1d2e-3f4a5b6c7d8e",
                    "keyword": "Portfolio Selection",
                    "description": "Maximizing returns while managing risk through resource allocation.",
                    "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                    "children": []
                },
                {
                    "id": "a7c9e1f3-8a9b-0c1d-2e3f-4a5b6c7d8e9f",
                    "keyword": "Linear Regression",
                    "description": "Modeling the relationship between dependent and independent variables.",
                    "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                    "children": [
                        {
                            "id": "b8d0f2a4-9b0c-1d2e-3f4a-5b6c7d8e9f0a",
                            "keyword": "Regression Techniques",
                            "description": "Methods of calculating estimates for a regression line.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        },
                        {
                            "id": "c9e1a3b5-0c1d-2e3f-4a5b-6c7d8e9f0a1b",
                            "keyword": "Linear Models",
                            "description": "Using linear equations to find best-fit coefficients.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "d0f2b4c6-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
                    "keyword": "Binary Classification and Geometric Optimization",
                    "description": "Assigning data points into categories using geometric optimization.",
                    "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                    "children": [
                        {
                            "id": "e1a3c5d7-2e3f-4a5b-6c7d-8e9f0a1b2c3d",
                            "keyword": "Data Separation",
                            "description": "Finding optimal separating line or hyperplane between categories.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        },
                        {
                            "id": "f2b4d6e8-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
                            "keyword": "Geometric Optimization",
                            "description": "Maximizing or minimizing distances between classes using geometric methods.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        }
                    ]
                }
            ]
        }
    ]
}




export const LP_MAP_CHAT: MapNode = {
    "id": "e8b8f656-2b8a-4c3d-99e0-9f8e1f0b7c5d",
    "keyword": "Linear Programming",
    "description": "Linear programming is a mathematical method for achieving the best outcome in a model whose requirements are represented by linear relationships.",
    "lectures": ["99c85304-93a7-4d4e-a1fd-931f219ae490"],
    "children": [
        {
            "id": "a5f6b0c1-9c2e-4b8a-8d5c-5a6d0c7f8e9b",
            "keyword": "Simplex Method",
            "description": "An iterative algorithm used to solve linear programming problems by systematically evaluating vertices of the feasible region.",
            "lectures": [
                "53a2414d-8647-4238-b29b-c8d829f01956",
                "d4750711-22f1-4639-8ab6-1e2393e88f68",
                "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3",
                "4bcb992c-ced5-454f-83c0-9478e6183b62"
            ],
            "children": [
                {
                    "id": "c7d8e9f0-1a2b-3c4d-5e6f-7a8b9c0d1e2f",
                    "keyword": "Graphical Representation of Constraints",
                    "description": "Visual depiction of constraints by plotting the feasible region that satisfies all constraints.",
                    "lectures": ["53a2414d-8647-4238-b29b-c8d829f01956"],
                    "children": []
                },
                {
                    "id": "d0e1f2a3-4b5c-6d7e-8f9a-0b1c2d3e4f5g",
                    "keyword": "Feasible Region and Vertices",
                    "description": "The feasible region is the set of all possible solutions satisfying all constraints; vertices represent critical points for finding the optimal solution.",
                    "lectures": ["53a2414d-8647-4238-b29b-c8d829f01956"],
                    "children": []
                },
                {
                    "id": "e1f2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5g6h",
                    "keyword": "Simplex Method Efficiency",
                    "description": "Analyzing the performance of the Simplex method in average and worst-case scenarios.",
                    "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                    "children": [
                        {
                            "id": "f2a3b4c5-6d7e-8f9a-0b1c-2d3e4f5g6h7i",
                            "keyword": "Average-Case Performance",
                            "description": "Evaluating the typical number of iterations required for different problem sizes.",
                            "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                            "children": []
                        },
                        {
                            "id": "a3b4c5d6-7e8f-9a0b-1c2d-3e4f5g6h7i8j",
                            "keyword": "Worst-Case Scenarios",
                            "description": "Exploring theoretical limitations of the algorithm in specific situations.",
                            "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "b4c5d6e7-8f9a-0b1c-2d3e-4f5g6h7i8j9k",
                    "keyword": "Simplex Matrix",
                    "description": "Matrix representation of LP problems used in the Simplex algorithm's iterative process.",
                    "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                    "children": [
                        {
                            "id": "c5d6e7f8-9a0b-1c2d-3e4f-5g6h7i8j9k0l",
                            "keyword": "Matrix Representation of LP Problems",
                            "description": "Using matrices to represent constraints and objective functions.",
                            "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                            "children": []
                        },
                        {
                            "id": "d6e7f8g9-a0b1-c2d3-e4f5-g6h7i8j9k0l1",
                            "keyword": "Simplex Algorithm Iterations",
                            "description": "Step-by-step process of modifying the matrix to find the optimal solution.",
                            "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "e7f8g9h0-b1c2-d3e4-f5g6-h7i8j9k0l1m2",
                    "keyword": "Dual Simplex Method",
                    "description": "A variation of the Simplex Method used when the initial solution is not feasible but the dual problem is.",
                    "lectures": ["4bcb992c-ced5-454f-83c0-9478e6183b62"],
                    "children": [
                        {
                            "id": "f8g9h0i1-c2d3-e4f5-g6h7-i8j9k0l1m2n3",
                            "keyword": "Simplex Method Variations",
                            "description": "Variations like the Dual Simplex Method and Phase I Algorithm used in specific scenarios.",
                            "lectures": ["4bcb992c-ced5-454f-83c0-9478e6183b62"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "g9h0i1j2-d3e4-f5g6-h7i8-j9k0l1m2n3o4",
            "keyword": "Duality in Linear Programming",
            "description": "Every linear programming problem has a corresponding dual problem; solving one provides insights into the other.",
            "lectures": [
                "df805eda-39bb-4147-b9da-ade25bb4908d",
                "0eec1a18-09b9-41d4-8d83-d346669cd75e",
                "f9f4f8f5-b140-4c60-b3d9-05c422f461f0",
                "dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"
            ],
            "children": [
                {
                    "id": "h0i1j2k3-e4f5-g6h7-i8j9-k0l1m2n3o4p5",
                    "keyword": "Primal and Dual Problems",
                    "description": "Pairs of LP problems where one is the original and the other has a reversed objective function and constraints.",
                    "lectures": ["df805eda-39bb-4147-b9da-ade25bb4908d"],
                    "children": []
                },
                {
                    "id": "i1j2k3l4-f5g6-h7i8-j9k0-l1m2n3o4p5q6",
                    "keyword": "Complementary Slackness",
                    "description": "A theorem relating primal and dual variables at optimality.",
                    "lectures": ["df805eda-39bb-4147-b9da-ade25bb4908d"],
                    "children": []
                },
                {
                    "id": "j2k3l4m5-g6h7-i8j9-k0l1-m2n3o4p5q6r7",
                    "keyword": "General Duality",
                    "description": "Establishing correspondence between a primal problem and its dual, where solving one solves the other.",
                    "lectures": ["0eec1a18-09b9-41d4-8d83-d346669cd75e"],
                    "children": [
                        {
                            "id": "k3l4m5n6-h7i8-j9k0-l1m2-n3o4p5q6r7s8",
                            "keyword": "Applications of Duality",
                            "description": "Real-world applications like resource allocation and supply chain management.",
                            "lectures": ["0eec1a18-09b9-41d4-8d83-d346669cd75e"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "l4m5n6o7-i8j9-k0l1-m2n3-o4p5q6r7s8t9",
                    "keyword": "Duality Examples",
                    "description": "Examples highlighting the connection between minimization and maximization problems.",
                    "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                    "children": [
                        {
                            "id": "m5n6o7p8-j9k0-l1m2-n3o4-p5q6r7s8t9u0",
                            "keyword": "Diet Problem",
                            "description": "Determining the optimal mix of foods to meet dietary needs at the lowest cost.",
                            "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                            "children": []
                        },
                        {
                            "id": "n6o7p8q9-k0l1-m2n3-o4p5-q6r7s8t9u0v1",
                            "keyword": "Dual Relationship",
                            "description": "Connecting minimization problems to their corresponding maximization problems.",
                            "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "o7p8q9r0-l1m2-n3o4-p5q6-r7s8t9u0v1w2",
                    "keyword": "Duality Sensitivity Analysis",
                    "description": "Analyzing how changes in constraints affect the optimal solution, focusing on primal-dual relationships.",
                    "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                    "children": [
                        {
                            "id": "p8q9r0s1-m2n3-o4p5-q6r7-s8t9u0v1w2x3",
                            "keyword": "Primal-Dual Relationship",
                            "description": "Fundamental connection between a maximization and its corresponding minimization problem.",
                            "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                            "children": []
                        },
                        {
                            "id": "q9r0s1t2-n3o4-p5q6-r7s8-t9u0v1w2x3y4",
                            "keyword": "Sensitivity Analysis Techniques",
                            "description": "Methods to evaluate the impact of changes in constraints or coefficients.",
                            "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "r0s1t2u3-o4p5-q6r7-s8t9-u0v1w2x3y4z5",
            "keyword": "Sensitivity and Parametric Analysis",
            "description": "Determining how changes in input data affect the optimal solution.",
            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
            "children": [
                {
                    "id": "s1t2u3v4-p5q6-r7s8-t9u0-v1w2x3y4z5a6",
                    "keyword": "Sensitivity Analysis",
                    "description": "Analyzing the impact of parameter changes on the optimal solution.",
                    "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                    "children": [
                        {
                            "id": "t2u3v4w5-q6r7-s8t9-u0v1-w2x3y4z5a6b7",
                            "keyword": "Impact of Parameter Changes",
                            "description": "Examining how changes in coefficients or RHS affect the solution.",
                            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                            "children": []
                        },
                        {
                            "id": "u3v4w5x6-r7s8-t9u0-v1w2-x3y4z5a6b7c8",
                            "keyword": "Optimal Solution Stability",
                            "description": "Evaluating the robustness of the optimal solution to small changes.",
                            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "v4w5x6y7-s8t9-u0v1-w2x3-y4z5a6b7c8d9",
                    "keyword": "Parametric Analysis",
                    "description": "Exploring how the optimal solution shifts as parameters vary over a range.",
                    "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                    "children": [
                        {
                            "id": "w5x6y7z8-t9u0-v1w2-x3y4-z5a6b7c8d9e0",
                            "keyword": "Objective Function Parameter Variations",
                            "description": "Examining the impact of changes in objective function parameters.",
                            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                            "children": []
                        },
                        {
                            "id": "x6y7z8a9-u0v1-w2x3-y4z5-a6b7c8d9e0f1",
                            "keyword": "Constraint Parameter Variations",
                            "description": "Evaluating how changes in constraints alter the optimal solution.",
                            "lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "y7z8a9b0-v1w2-x3y4-z5a6-b7c8d9e0f1g2",
            "keyword": "Convex Analysis and Farkas Lemma",
            "description": "Studying convex sets and the Farkas Lemma, foundational for solving optimization problems.",
            "lectures": [
                "b1f987e0-f002-4932-b835-3ad3ade23b22",
                "b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"
            ],
            "children": [
                {
                    "id": "z8a9b0c1-w2x3-y4z5-a6b7-c8d9e0f1g2h3",
                    "keyword": "Convex Analysis",
                    "description": "Studies convex sets, combinations, hulls, and separation theorems.",
                    "lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
                    "children": [
                        {
                            "id": "a9b0c1d2-x3y4-z5a6-b7c8-d9e0f1g2h3i4",
                            "keyword": "Convex Sets & Combinations",
                            "description": "Defines convex sets and their relationships with contained points.",
                            "lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
                            "children": []
                        },
                        {
                            "id": "b0c1d2e3-y4z5-a6b7-c8d9-e0f1g2h3i4j5",
                            "keyword": "Separation Theorems & Convex Hulls",
                            "description": "Tools for analyzing and solving optimization problems involving convex sets.",
                            "lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "c1d2e3f4-z5a6-b7c8-d9e0-f1g2h3i4j5k6",
                    "keyword": "Farkas Lemma",
                    "description": "Establishes a relationship between the solvability of a system of linear inequalities and the existence of a particular solution.",
                    "lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
                    "children": [
                        {
                            "id": "d2e3f4g5-a6b7-c8d9-e0f1-g2h3i4j5k6l7",
                            "keyword": "Feasibility",
                            "description": "Condition where a non-negative solution exists to satisfy the inequalities.",
                            "lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
                            "children": []
                        },
                        {
                            "id": "e3f4g5h6-b7c8-d9e0-f1g2-h3i4j5k6l7m8",
                            "keyword": "Infeasibility",
                            "description": "Condition indicating the original system is not solvable.",
                            "lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "f4g5h6i7-c8d9-e0f1-g2h3-i4j5k6l7m8n9",
            "keyword": "Integer Programming",
            "description": "Optimization problems where some or all variables must be integer values.",
            "lectures": [
                "866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81",
                "6a3bce7c-84d0-438b-8428-c5a79d404f85"
            ],
            "children": [
                {
                    "id": "g5h6i7j8-d9e0-f1g2-h3i4-j5k6l7m8n9o0",
                    "keyword": "Integer Programming Methods",
                    "description": "Methods for solving integer programming problems.",
                    "lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
                    "children": [
                        {
                            "id": "h6i7j8k9-e0f1-g2h3-i4j5-k6l7m8n9o0p1",
                            "keyword": "Branch-and-Bound Method",
                            "description": "Systematically explores solution space by creating subproblems and bounding them.",
                            "lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
                            "children": []
                        },
                        {
                            "id": "i7j8k9l0-f1g2-h3i4-j5k6-l7m8n9o0p1q2",
                            "keyword": "Gomory Cuts",
                            "description": "Technique used to refine feasible region and force integer solutions.",
                            "lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "j8k9l0m1-g2h3-i4j5-k6l7-m8n9o0p1q2r3",
                    "keyword": "Integer Programming Examples",
                    "description": "Applications requiring integer solutions in areas like scheduling and resource allocation.",
                    "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                    "children": [
                        {
                            "id": "k9l0m1n2-h3i4-j5k6-l7m8-n9o0p1q2r3s4",
                            "keyword": "Maximum Weight Matching",
                            "description": "Optimizing the assignment of tasks or resources for best outcome.",
                            "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                            "children": []
                        },
                        {
                            "id": "l0m1n2o3-i4j5-k6l7-m8n9-o0p1q2r3s4t5",
                            "keyword": "Machine Scheduling and Knapsack Problems",
                            "description": "Scheduling tasks and optimizing resource allocation in constrained scenarios.",
                            "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "m1n2o3p4-j5k6-l7m8-n9o0-p1q2r3s4t5u6",
            "keyword": "Network Flow",
            "description": "Optimizing movement through networks of interconnected points.",
            "lectures": [
                "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
                "f242d8c5-a635-4384-b3bb-ed7a94a9b980",
                "0ce8c393-2665-4132-ae76-5b409dc704e6"
            ],
            "children": [
                {
                    "id": "n2o3p4q5-k6l7-m8n9-o0p1-q2r3s4t5u6v7",
                    "keyword": "Formulation as a Linear Program",
                    "description": "Expressing network flow problems as optimization problems with linear objectives and constraints.",
                    "lectures": ["b07f46a7-cbf0-41b4-823a-4e8374f61b01"],
                    "children": []
                },
                {
                    "id": "o3p4q5r6-l7m8-n9o0-p1q2-r3s4t5u6v7w8",
                    "keyword": "Spanning Trees and Optimality",
                    "description": "Spanning trees serve as starting points for optimization algorithms.",
                    "lectures": [
                        "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
                        "0ce8c393-2665-4132-ae76-5b409dc704e6"
                    ],
                    "children": [
                        {
                            "id": "p4q5r6s7-m8n9-o0p1-q2r3-s4t5u6v7w8x9",
                            "keyword": "Network Simplex Method",
                            "description": "Specialized algorithm leveraging spanning trees to optimize flow.",
                            "lectures": ["0ce8c393-2665-4132-ae76-5b409dc704e6"],
                            "children": [
                                {
                                    "id": "q5r6s7t8-n9o0-p1q2-r3s4-t5u6v7w8x9y0",
                                    "keyword": "Spanning Tree Optimization",
                                    "description": "Using spanning trees for efficiently optimizing flows.",
                                    "lectures": ["0ce8c393-2665-4132-ae76-5b409dc704e6"],
                                    "children": []
                                }
                            ]
                        }
                    ]
                },
                {
                    "id": "r6s7t8u9-o0p1-q2r3-s4t5-u6v7w8x9y0z1",
                    "keyword": "Network Applications",
                    "description": "Optimizing resource flow through networks, including transportation and shortest paths.",
                    "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                    "children": [
                        {
                            "id": "s7t8u9v0-p1q2-r3s4-t5u6-v7w8x9y0z1a2",
                            "keyword": "Transportation Problems",
                            "description": "Minimizing cost of transporting resources from origins to destinations.",
                            "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                            "children": []
                        },
                        {
                            "id": "t8u9v0w1-q2r3-s4t5-u6v7-w8x9y0z1a2b3",
                            "keyword": "Shortest Path Problems",
                            "description": "Finding optimal routes between two points in a network.",
                            "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "u9v0w1x2-r3s4-t5u6-v7w8-x9y0z1a2b3c4",
            "keyword": "Applications of Linear Programming",
            "description": "Practical applications including production planning, portfolio optimization, regression, and classification.",
            "lectures": [
                "6a3bce7c-84d0-438b-8428-c5a79d404f85",
                "fb8a8493-d3e8-4197-81dd-fd398b8080fb"
            ],
            "children": [
                {
                    "id": "v0w1x2y3-s4t5-u6v7-w8x9-y0z1a2b3c4d5",
                    "keyword": "Production Planning",
                    "description": "Optimizing production levels to meet demand while considering costs.",
                    "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                    "children": []
                },
                {
                    "id": "w1x2y3z4-t5u6-v7w8-x9y0-z1a2b3c4d5e6",
                    "keyword": "Portfolio Selection",
                    "description": "Maximizing returns while managing risk through resource allocation.",
                    "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                    "children": []
                },
                {
                    "id": "x2y3z4a5-u6v7-w8x9-y0z1-a2b3c4d5e6f7",
                    "keyword": "Linear Regression",
                    "description": "Modeling the relationship between dependent and independent variables.",
                    "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                    "children": [
                        {
                            "id": "y3z4a5b6-v7w8-x9y0-z1a2-b3c4d5e6f7g8",
                            "keyword": "Regression Techniques",
                            "description": "Methods of calculating estimates for a regression line.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        },
                        {
                            "id": "z4a5b6c7-w8x9-y0z1-a2b3-c4d5e6f7g8h9",
                            "keyword": "Linear Models",
                            "description": "Using linear equations to find best-fit coefficients.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "a5b6c7d8-x9y0-z1a2-b3c4-d5e6f7g8h9i0",
                    "keyword": "Binary Classification and Geometric Optimization",
                    "description": "Assigning data points into categories using geometric optimization.",
                    "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                    "children": [
                        {
                            "id": "b6c7d8e9-y0z1-a2b3-c4d5-e6f7g8h9i0j1",
                            "keyword": "Data Separation",
                            "description": "Finding optimal separating line or hyperplane between categories.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        },
                        {
                            "id": "c7d8e9f0-z1a2-b3c4-d5e6-f7g8h9i0j1k2",
                            "keyword": "Geometric Optimization",
                            "description": "Maximizing or minimizing distances between classes using geometric methods.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        }
                    ]
                }
            ]
        }
    ]
}


export const LP_MAP_CHAT_EDIT: MapNode = {
    "id": "e8b8f656-2b8a-4c3d-99e0-9f8e1f0b7c5d",
    "keyword": "Linear Programming",
    "description": "Linear programming is a mathematical method for achieving the best outcome in a model whose requirements are represented by linear relationships.",
    "lectures": ["99c85304-93a7-4d4e-a1fd-931f219ae490"],
    "children": [
        {
            "id": "a5f6b0c1-9c2e-4b8a-8d5c-5a6d0c7f8e9b",
            "keyword": "Simplex Method",
            "description": "An iterative algorithm used to solve linear programming problems by systematically evaluating vertices of the feasible region.",
            "lectures": [
                "53a2414d-8647-4238-b29b-c8d829f01956",
                "d4750711-22f1-4639-8ab6-1e2393e88f68",
                "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3",
                "4bcb992c-ced5-454f-83c0-9478e6183b62"
            ],
            "children": [
                {
                    "id": "c7d8e9f0-1a2b-3c4d-5e6f-7a8b9c0d1e2f",
                    "keyword": "Graphical Representation",
                    "description": "Visual depiction of constraints by plotting the feasible region that satisfies all constraints.",
                    "lectures": ["53a2414d-8647-4238-b29b-c8d829f01956"],
                    "children": []
                },
                {
                    "id": "d0e1f2a3-4b5c-6d7e-8f9a-0b1c2d3e4f5g",
                    "keyword": "Feasible Region",
                    "description": "The feasible region is the set of all possible solutions satisfying all constraints; vertices represent critical points for finding the optimal solution.",
                    "lectures": ["53a2414d-8647-4238-b29b-c8d829f01956"],
                    "children": []
                },
                {
                    "id": "e1f2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5g6h",
                    "keyword": "Simplex Method Efficiency",
                    "description": "Analyzing the performance of the Simplex method in average and worst-case scenarios.",
                    "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                    "children": [
                        {
                            "id": "f2a3b4c5-6d7e-8f9a-0b1c-2d3e4f5g6h7i",
                            "keyword": "Average-Case Performance",
                            "description": "Evaluating the typical number of iterations required for different problem sizes.",
                            "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                            "children": []
                        },
                        {
                            "id": "a3b4c5d6-7e8f-9a0b-1c2d-3e4f5g6h7i8j",
                            "keyword": "Worst-Case Scenarios",
                            "description": "Exploring theoretical limitations of the algorithm in specific situations.",
                            "lectures": ["d4750711-22f1-4639-8ab6-1e2393e88f68"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "b4c5d6e7-8f9a-0b1c-2d3e-4f5g6h7i8j9k",
                    "keyword": "Simplex Matrix",
                    "description": "Matrix representation of LP problems used in the Simplex algorithm's iterative process.",
                    "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                    "children": [
                        {
                            "id": "c5d6e7f8-9a0b-1c2d-3e4f-5g6h7i8j9k0l",
                            "keyword": "Matrix Representation",
                            "description": "Using matrices to represent constraints and objective functions.",
                            "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                            "children": []
                        },
                        {
                            "id": "d6e7f8g9-a0b1-c2d3-e4f5-g6h7i8j9k0l1",
                            "keyword": "Simplex Algorithm",
                            "description": "Step-by-step process of modifying the matrix to find the optimal solution.",
                            "lectures": ["24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "e7f8g9h0-b1c2-d3e4-f5g6-h7i8j9k0l1m2",
                    "keyword": "Dual Simplex Method",
                    "description": "A variation of the Simplex Method used when the initial solution is not feasible but the dual problem is.",
                    "lectures": ["4bcb992c-ced5-454f-83c0-9478e6183b62"],
                    "children": [
                        {
                            "id": "f8g9h0i1-c2d3-e4f5-g6h7-i8j9k0l1m2n3",
                            "keyword": "Simplex Method Variations",
                            "description": "Variations like the Dual Simplex Method and Phase I Algorithm used in specific scenarios.",
                            "lectures": ["4bcb992c-ced5-454f-83c0-9478e6183b62"],
                            "children": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "g9h0i1j2-d3e4-f5g6-h7i8-j9k0l1m2n3o4",
            "keyword": "Duality",
            "description": "Every linear programming problem has a corresponding dual problem; solving one provides insights into the other.",
            "lectures": [
                "df805eda-39bb-4147-b9da-ade25bb4908d",
                "0eec1a18-09b9-41d4-8d83-d346669cd75e",
                "f9f4f8f5-b140-4c60-b3d9-05c422f461f0",
                "dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"
            ],
            "children": [
                {
                    "id": "h0i1j2k3-e4f5-g6h7-i8j9-k0l1m2n3o4p5",
                    "keyword": "Primal and Dual",
                    "description": "Pairs of LP problems where one is the original and the other has a reversed objective function and constraints.",
                    "lectures": ["df805eda-39bb-4147-b9da-ade25bb4908d"],
                    "children": []
                },
                {
                    "id": "i1j2k3l4-f5g6-h7i8-j9k0-l1m2n3o4p5q6",
                    "keyword": "Complementary Slackness",
                    "description": "A theorem relating primal and dual variables at optimality.",
                    "lectures": ["df805eda-39bb-4147-b9da-ade25bb4908d"],
                    "children": []
                },
                {
                    "id": "j2k3l4m5-g6h7-i8j9-k0l1-m2n3o4p5q6r7",
                    "keyword": "General Duality",
                    "description": "Establishing correspondence between a primal problem and its dual, where solving one solves the other.",
                    "lectures": ["0eec1a18-09b9-41d4-8d83-d346669cd75e"],
                    "children": [
                        {
                            "id": "k3l4m5n6-h7i8-j9k0-l1m2-n3o4p5q6r7s8",
                            "keyword": "Applications of Duality",
                            "description": "Real-world applications like resource allocation and supply chain management.",
                            "lectures": ["0eec1a18-09b9-41d4-8d83-d346669cd75e"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "l4m5n6o7-i8j9-k0l1-m2n3-o4p5q6r7s8t9",
                    "keyword": "Duality Examples",
                    "description": "Examples highlighting the connection between minimization and maximization problems.",
                    "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                    "children": [
                        {
                            "id": "m5n6o7p8-j9k0-l1m2-n3o4-p5q6r7s8t9u0",
                            "keyword": "Diet Problem",
                            "description": "Determining the optimal mix of foods to meet dietary needs at the lowest cost.",
                            "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                            "children": []
                        },
                        {
                            "id": "n6o7p8q9-k0l1-m2n3-o4p5-q6r7s8t9u0v1",
                            "keyword": "Dual Relationship",
                            "description": "Connecting minimization problems to their corresponding maximization problems.",
                            "lectures": ["f9f4f8f5-b140-4c60-b3d9-05c422f461f0"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "o7p8q9r0-l1m2-n3o4-p5q6-r7s8t9u0v1w2",
                    "keyword": "Duality Sensitivity",
                    "description": "Analyzing how changes in constraints affect the optimal solution, focusing on primal-dual relationships.",
                    "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                    "children": [
                        {
                            "id": "p8q9r0s1-m2n3-o4p5-q6r7-s8t9u0v1w2x3",
                            "keyword": "Primal-Dual",
                            "description": "Fundamental connection between a maximization and its corresponding minimization problem.",
                            "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                            "children": []
                        },
                        {
                            "id": "q9r0s1t2-n3o4-p5q6-r7s8-t9u0v1w2x3y4",
                            "keyword": "Sensitivity",
                            "description": "Methods to evaluate the impact of changes in constraints or coefficients.",
                            "lectures": ["dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"],
                            "children": []
                        }
                    ]
                }
            ]
        },

		{
            "id": "m1n2o3p4-j5k6-l7m8-n9o0-p1q2r3s4t5u6",
            "keyword": "Network Flow",
            "description": "Optimizing movement through networks of interconnected points.",
            "lectures": [
                "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
                "f242d8c5-a635-4384-b3bb-ed7a94a9b980",
                "0ce8c393-2665-4132-ae76-5b409dc704e6"
            ],
            "children": [
                {
                    "id": "n2o3p4q5-k6l7-m8n9-o0p1-q2r3s4t5u6v7",
                    "keyword": "Formulation as a Linear Program",
                    "description": "Expressing network flow problems as optimization problems with linear objectives and constraints.",
                    "lectures": ["b07f46a7-cbf0-41b4-823a-4e8374f61b01"],
                    "children": []
                },
                {
                    "id": "o3p4q5r6-l7m8-n9o0-p1q2-r3s4t5u6v7w8",
                    "keyword": "Spanning Trees and Optimality",
                    "description": "Spanning trees serve as starting points for optimization algorithms.",
                    "lectures": [
                        "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
                        "0ce8c393-2665-4132-ae76-5b409dc704e6"
                    ],
                    "children": [
                        {
                            "id": "p4q5r6s7-m8n9-o0p1-q2r3-s4t5u6v7w8x9",
                            "keyword": "Network Simplex Method",
                            "description": "Specialized algorithm leveraging spanning trees to optimize flow.",
                            "lectures": ["0ce8c393-2665-4132-ae76-5b409dc704e6"],
                            "children": [
                                {
                                    "id": "q5r6s7t8-n9o0-p1q2-r3s4-t5u6v7w8x9y0",
                                    "keyword": "Spanning Tree Optimization",
                                    "description": "Using spanning trees for efficiently optimizing flows.",
                                    "lectures": ["0ce8c393-2665-4132-ae76-5b409dc704e6"],
                                    "children": []
                                }
                            ]
                        }
                    ]
                },
                {
                    "id": "r6s7t8u9-o0p1-q2r3-s4t5-u6v7w8x9y0z1",
                    "keyword": "Network Applications",
                    "description": "Optimizing resource flow through networks, including transportation and shortest paths.",
                    "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                    "children": [
                        {
                            "id": "s7t8u9v0-p1q2-r3s4-t5u6-v7w8x9y0z1a2",
                            "keyword": "Transportation Problems",
                            "description": "Minimizing cost of transporting resources from origins to destinations.",
                            "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                            "children": []
                        },
                        {
                            "id": "t8u9v0w1-q2r3-s4t5-u6v7-w8x9y0z1a2b3",
                            "keyword": "Shortest Path Problems",
                            "description": "Finding optimal routes between two points in a network.",
                            "lectures": ["f242d8c5-a635-4384-b3bb-ed7a94a9b980"],
                            "children": []
                        }
                    ]
                }
            ]
        },
		{
            "id": "u9v0w1x2-r3s4-t5u6-v7w8-x9y0z1a2b3c4",
            "keyword": "Applications of Linear Programming",
            "description": "Practical applications including production planning, portfolio optimization, regression, and classification.",
            "lectures": [
                "6a3bce7c-84d0-438b-8428-c5a79d404f85",
                "fb8a8493-d3e8-4197-81dd-fd398b8080fb",
				"9c83bfa8-d773-4ace-b84a-21f7d814b33c",
				"b1f987e0-f002-4932-b835-3ad3ade23b22",
				"866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81",
				"6a3bce7c-84d0-438b-8428-c5a79d404f85",
				"b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"
            ],
            "children": [
                {
                    "id": "v0w1x2y3-s4t5-u6v7-w8x9-y0z1a2b3c4d5",
                    "keyword": "Production Planning",
                    "description": "Optimizing production levels to meet demand while considering costs.",
                    "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                    "children": []
                },
                {
                    "id": "w1x2y3z4-t5u6-v7w8-x9y0-z1a2b3c4d5e6",
                    "keyword": "Portfolio Selection",
                    "description": "Maximizing returns while managing risk through resource allocation.",
                    "lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
                    "children": []
                },
                {
                    "id": "x2y3z4a5-u6v7-w8x9-y0z1-a2b3c4d5e6f7",
                    "keyword": "Linear Regression",
                    "description": "Modeling the relationship between dependent and independent variables.",
                    "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                    "children": [
                        {
                            "id": "y3z4a5b6-v7w8-x9y0-z1a2-b3c4d5e6f7g8",
                            "keyword": "Regression Techniques",
                            "description": "Methods of calculating estimates for a regression line.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        },
                        {
                            "id": "z4a5b6c7-w8x9-y0z1-a2b3-c4d5e6f7g8h9",
                            "keyword": "Linear Models",
                            "description": "Using linear equations to find best-fit coefficients.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        }
                    ]
                },
                {
                    "id": "a5b6c7d8-x9y0-z1a2-b3c4-d5e6f7g8h9i0",
                    "keyword": "Binary Classification and Geometric Optimization",
                    "description": "Assigning data points into categories using geometric optimization.",
                    "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                    "children": [
                        {
                            "id": "b6c7d8e9-y0z1-a2b3-c4d5-e6f7g8h9i0j1",
                            "keyword": "Data Separation",
                            "description": "Finding optimal separating line or hyperplane between categories.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        },
                        {
                            "id": "c7d8e9f0-z1a2-b3c4-d5e6-f7g8h9i0j1k2",
                            "keyword": "Geometric Optimization",
                            "description": "Maximizing or minimizing distances between classes using geometric methods.",
                            "lectures": ["fb8a8493-d3e8-4197-81dd-fd398b8080fb"],
                            "children": []
                        }
                    ]
                },
				{
					"id": "r0s1t2u3-o4p5-q6r7-s8t9-u0v1w2x3y4z5",
					"keyword": "Sensitivity and Parametric Analysis",
					"description": "Determining how changes in input data affect the optimal solution.",
					"lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
					"children": [
						{
							"id": "s1t2u3v4-p5q6-r7s8-t9u0-v1w2x3y4z5a6",
							"keyword": "Sensitivity",
							"description": "Analyzing the impact of parameter changes on the optimal solution.",
							"lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
							"children": [
								{
									"id": "t2u3v4w5-q6r7-s8t9-u0v1-w2x3y4z5a6b7",
									"keyword": "Impact of Parameter Changes",
									"description": "Examining how changes in coefficients or RHS affect the solution.",
									"lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
									"children": []
								},
								{
									"id": "u3v4w5x6-r7s8-t9u0-v1w2-x3y4z5a6b7c8",
									"keyword": "Optimal Solution Stability",
									"description": "Evaluating the robustness of the optimal solution to small changes.",
									"lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
									"children": []
								}
							]
						},
						{
							"id": "v4w5x6y7-s8t9-u0v1-w2x3-y4z5a6b7c8d9",
							"keyword": "Parametric Analysis",
							"description": "Exploring how the optimal solution shifts as parameters vary over a range.",
							"lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
							"children": [
								{
									"id": "w5x6y7z8-t9u0-v1w2-x3y4-z5a6b7c8d9e0",
									"keyword": "Objective Function Parameter Variations",
									"description": "Examining the impact of changes in objective function parameters.",
									"lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
									"children": []
								},
								{
									"id": "x6y7z8a9-u0v1-w2x3-y4z5-a6b7c8d9e0f1",
									"keyword": "Constraint Parameter Variations",
									"description": "Evaluating how changes in constraints alter the optimal solution.",
									"lectures": ["9c83bfa8-d773-4ace-b84a-21f7d814b33c"],
									"children": []
								}
							]
						}
					]
				},{
					"id": "y7z8a9b0-v1w2-x3y4-z5a6-b7c8d9e0f1g2",
					"keyword": "Convex Analysis and Farkas Lemma",
					"description": "Studying convex sets and the Farkas Lemma, foundational for solving optimization problems.",
					"lectures": [
						"b1f987e0-f002-4932-b835-3ad3ade23b22",
						"b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"
					],
					"children": [
						{
							"id": "z8a9b0c1-w2x3-y4z5-a6b7-c8d9e0f1g2h3",
							"keyword": "Convex Analysis",
							"description": "Studies convex sets, combinations, hulls, and separation theorems.",
							"lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
							"children": [
								{
									"id": "a9b0c1d2-x3y4-z5a6-b7c8-d9e0f1g2h3i4",
									"keyword": "Convex Sets & Combinations",
									"description": "Defines convex sets and their relationships with contained points.",
									"lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
									"children": []
								},
								{
									"id": "b0c1d2e3-y4z5-a6b7-c8d9-e0f1g2h3i4j5",
									"keyword": "Separation Theorems & Convex Hulls",
									"description": "Tools for analyzing and solving optimization problems involving convex sets.",
									"lectures": ["b1f987e0-f002-4932-b835-3ad3ade23b22"],
									"children": []
								}
							]
						},
						{
							"id": "c1d2e3f4-z5a6-b7c8-d9e0-f1g2h3i4j5k6",
							"keyword": "Farkas Lemma",
							"description": "Establishes a relationship between the solvability of a system of linear inequalities and the existence of a particular solution.",
							"lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
							"children": [
								{
									"id": "d2e3f4g5-a6b7-c8d9-e0f1-g2h3i4j5k6l7",
									"keyword": "Feasibility",
									"description": "Condition where a non-negative solution exists to satisfy the inequalities.",
									"lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
									"children": []
								},
								{
									"id": "e3f4g5h6-b7c8-d9e0-f1g2-h3i4j5k6l7m8",
									"keyword": "Infeasibility",
									"description": "Condition indicating the original system is not solvable.",
									"lectures": ["b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"],
									"children": []
								}
							]
						}
					]
				},         {
					"id": "f4g5h6i7-c8d9-e0f1-g2h3-i4j5k6l7m8n9",
					"keyword": "Integer Programming",
					"description": "Optimization problems where some or all variables must be integer values.",
					"lectures": [
						"866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81",
						"6a3bce7c-84d0-438b-8428-c5a79d404f85"
					],
					"children": [
						{
							"id": "g5h6i7j8-d9e0-f1g2-h3i4-j5k6l7m8n9o0",
							"keyword": "Integer Programming Methods",
							"description": "Methods for solving integer programming problems.",
							"lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
							"children": [
								{
									"id": "h6i7j8k9-e0f1-g2h3-i4j5-k6l7m8n9o0p1",
									"keyword": "Branch-and-Bound Method",
									"description": "Systematically explores solution space by creating subproblems and bounding them.",
									"lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
									"children": []
								},
								{
									"id": "i7j8k9l0-f1g2-h3i4-j5k6-l7m8n9o0p1q2",
									"keyword": "Gomory Cuts",
									"description": "Technique used to refine feasible region and force integer solutions.",
									"lectures": ["866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"],
									"children": []
								}
							]
						},
						{
							"id": "j8k9l0m1-g2h3-i4j5-k6l7-m8n9o0p1q2r3",
							"keyword": "Integer Programming Examples",
							"description": "Applications requiring integer solutions in areas like scheduling and resource allocation.",
							"lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
							"children": [
								{
									"id": "k9l0m1n2-h3i4-j5k6-l7m8-n9o0p1q2r3s4",
									"keyword": "Maximum Weight Matching",
									"description": "Optimizing the assignment of tasks or resources for best outcome.",
									"lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
									"children": []
								},
								{
									"id": "l0m1n2o3-i4j5-k6l7-m8n9-o0p1q2r3s4t5",
									"keyword": "Machine Scheduling and Knapsack Problems",
									"description": "Scheduling tasks and optimizing resource allocation in constrained scenarios.",
									"lectures": ["6a3bce7c-84d0-438b-8428-c5a79d404f85"],
									"children": []
								}
							]
						}
					]
				}
            ]
        }
    ]
}



export const LP_MAP: MapNode = {
    "id": "3983037c-eb8b-4406-a045-db80de15fc20",
    "keyword": "Linear Programming And Optimization Techniques",
    "description": "Linear programming is a mathematical method for achieving the best outcome (such as maximum profit or lowest cost) in a mathematical model whose requirements are represented by linear relationships.",
    "lectures": [
        "53a2414d-8647-4238-b29b-c8d829f01956",
		"d4750711-22f1-4639-8ab6-1e2393e88f68",
        "df805eda-39bb-4147-b9da-ade25bb4908d",
        "0eec1a18-09b9-41d4-8d83-d346669cd75e",
        "f9f4f8f5-b140-4c60-b3d9-05c422f461f0",
        "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3",
        "9c83bfa8-d773-4ace-b84a-21f7d814b33c",
        "b1f987e0-f002-4932-b835-3ad3ade23b22",
        "b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96",
        "866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81",
        "b07f46a7-cbf0-41b4-823a-4e8374f61b01",
        "f242d8c5-a635-4384-b3bb-ed7a94a9b980",
        "fb8a8493-d3e8-4197-81dd-fd398b8080fb",
		"6a3bce7c-84d0-438b-8428-c5a79d404f85",
		"0ce8c393-2665-4132-ae76-5b409dc704e6",
		"d58d9674-ae2f-4bd5-a263-d1e428fd096b",
		"0eec1a18-09b9-41d4-8d83-d346669cd75e",
		"dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90",
		"4bcb992c-ced5-454f-83c0-9478e6183b62",
		"99c85304-93a7-4d4e-a1fd-931f219ae490"
	],
    "children": [
        {
            "id": "d58d9674-ae2f-4bd5-a263-d1e428fd096b",
            "keyword": "Simplex Method",
            "description": "The Simplex Method is an iterative algorithm used to solve linear programming problems, systematically evaluating vertices of the feasible region to find the optimal solution.",
            "lectures": [
                "53a2414d-8647-4238-b29b-c8d829f01956"
            ],
            "children": [
                {
                    "id": "ebf4f1cf-ae2a-411e-95ca-b3ce2f997c1b",
                    "keyword": "Graphical Representation of Constraints",
                    "description": "Graphical representation visually displays the constraints of a linear programming problem by plotting the region in the graph that satisfies all constraints simultaneously.",
                    "lectures": [
                        "53a2414d-8647-4238-b29b-c8d829f01956"
                    ],
                    "children": []
                },
                {
                    "id": "31129895-a9ce-4a87-bb5d-9c2362f6945f",
                    "keyword": "Feasible Region and Vertices",
                    "description": "The feasible region is the set of all possible solutions that satisfy all the constraints of a linear programming problem; vertices represent important points for finding the optimal solution.",
                    "lectures": [
                        "53a2414d-8647-4238-b29b-c8d829f01956"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "15462baf-7a06-44c0-89f9-75998f719fd6",
            "keyword": "Simplex Method Efficiency",
            "description": "The Simplex method's efficiency in solving linear programming problems is analyzed, considering average and worst-case scenarios.",
            "lectures": [
                "d4750711-22f1-4639-8ab6-1e2393e88f68"
            ],
            "children": [
                {
                    "id": "b7e479bc-fa17-45b9-9140-5aa440735747",
                    "keyword": "Average-Case Performance",
                    "description": "The Simplex method's average-case performance is evaluated by considering the typical number of iterations required for different problem sizes.",
                    "lectures": [
                        "d4750711-22f1-4639-8ab6-1e2393e88f68"
                    ],
                    "children": []
                },
                {
                    "id": "7cef3b9d-3157-41de-afc3-7bcf6b2443f9",
                    "keyword": "Worst-Case Scenarios",
                    "description": "The Simplex method's worst-case performance is explored to highlight the theoretical limitations of the algorithm in specific situations.",
                    "lectures": [
                        "d4750711-22f1-4639-8ab6-1e2393e88f68"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "1f815ea5-c588-4b49-84bf-2ab15232cd7a",
            "keyword": "Duality",
            "description": "Duality in linear programming refers to the principle that every linear programming problem has a corresponding dual problem, where the optimal solution to either problem yields the optimal solution to the other.",
            "lectures": [
                "df805eda-39bb-4147-b9da-ade25bb4908d"
            ],
            "children": [
                {
                    "id": "091a7ab4-2b26-46ba-b45a-ceec1e3dec81",
                    "keyword": "Primal and Dual Problems",
                    "description": "Primal and dual problems are pairs of linear programming problems, with the primal problem being the original problem, and the dual problem having a reverse objective function and related constraints.",
                    "lectures": [
                        "df805eda-39bb-4147-b9da-ade25bb4908d"
                    ],
                    "children": []
                },
                {
                    "id": "d67dc1d4-438c-4954-8547-917bc4537450",
                    "keyword": "Simplex Method & Complementary Slackness",
                    "description": "The simplex method is an algorithm used to solve linear programming problems, and complementary slackness is a theorem relating primal and dual variables at optimality.",
                    "lectures": [
                        "df805eda-39bb-4147-b9da-ade25bb4908d"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "75467a7e-6dc2-49bb-8fca-cda1e1f246f5",
            "keyword": "General Duality",
            "description": "General Duality in Linear Programming establishes a correspondence between a primal optimization problem and its dual, where solving one problem implicitly solves the other.",
            "lectures": [
                "0eec1a18-09b9-41d4-8d83-d346669cd75e"
            ],
            "children": [
                {
                    "id": "c2e1f0ab-c3a9-45e4-8693-51975ca8b0c3",
                    "keyword": "Applications of Duality",
                    "description": "Duality in linear programming has real-world applications like resource allocation, portfolio optimization, and supply chain management.",
                    "lectures": [
                        "0eec1a18-09b9-41d4-8d83-d346669cd75e"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "20717c70-5cd9-4257-b246-2a0c7cdb5bce",
            "keyword": "Duality Examples",
            "description": "Duality examples in linear programming highlight the connection between minimization and maximization problems.",
            "lectures": [
                "f9f4f8f5-b140-4c60-b3d9-05c422f461f0"
            ],
            "children": [
                {
                    "id": "441d7a2c-ce2f-47ae-b35a-3eec8d9f52b2",
                    "keyword": "Diet Problem",
                    "description": "The Diet Problem is a linear programming model used to determine the optimal mix of foods to meet dietary needs at the lowest cost.",
                    "lectures": [
                        "f9f4f8f5-b140-4c60-b3d9-05c422f461f0"
                    ],
                    "children": []
                },
                {
                    "id": "d09f949a-7880-41b0-8dbf-c3283a68fb06",
                    "keyword": "Dual Relationship",
                    "description": "A dual relationship in linear programming connects a minimization problem to its corresponding maximization problem, allowing for alternative solution methods.",
                    "lectures": [
                        "f9f4f8f5-b140-4c60-b3d9-05c422f461f0"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "5864e57d-def6-4ddc-bc47-281e5fd19f68",
            "keyword": "Simplex Matrix",
            "description": "A matrix representation of linear programming problems, used in the Simplex algorithm's iterative process.",
            "lectures": [
                "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"
            ],
            "children": [
                {
                    "id": "79f0f542-6bd5-4c8f-9cab-5e55efe785e8",
                    "keyword": "Matrix Representation of LP Problems",
                    "description": "Using matrices to represent linear programming problem constraints and objective function.",
                    "lectures": [
                        "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"
                    ],
                    "children": []
                },
                {
                    "id": "a5d3762a-0192-4469-8f01-7e39145c9220",
                    "keyword": "Simplex Algorithm Iterations",
                    "description": "The step-by-step process of the Simplex algorithm, modifying the matrix representation to find the optimal solution.",
                    "lectures": [
                        "24870d1e-c0cc-4c33-bdb6-aae0c0957dd3"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "51208ba3-64b4-48d4-86b9-6fb1e2821305",
            "keyword": "Sensitivity Analysis",
            "description": "Sensitivity analysis determines how changes in input data affect the optimal solution of a linear programming problem.",
            "lectures": [
                "9c83bfa8-d773-4ace-b84a-21f7d814b33c"
            ],
            "children": [
                {
                    "id": "b2312cb3-2087-4ea1-ac56-4097b8791480",
                    "keyword": "Impact of Parameter Changes",
                    "description": "Examining how alterations in objective function coefficients or constraint right-hand sides (RHS) influence the optimal solution and its value.",
                    "lectures": [
                        "9c83bfa8-d773-4ace-b84a-21f7d814b33c"
                    ],
                    "children": []
                },
                {
                    "id": "45b82e6c-fd0e-40e4-9374-85f4cc652371",
                    "keyword": "Optimal Solution Stability",
                    "description": "Evaluating the robustness of the optimal solution to small changes in the problem's parameters, typically by the perturbation of constraints or objective function coefficients.",
                    "lectures": [
                        "9c83bfa8-d773-4ace-b84a-21f7d814b33c"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "cbb8e7f3-50a7-4c00-8df6-d4bac6e3354b",
            "keyword": "Parametric Analysis",
            "description": "Parametric analysis explores how the optimal solution shifts as parameters of a linear programming problem are varied over a range of values.",
            "lectures": [
                "9c83bfa8-d773-4ace-b84a-21f7d814b33c"
            ],
            "children": [
                {
                    "id": "9138aaf9-5f92-476c-b420-6382421f64eb",
                    "keyword": "Objective Function Parameter Variations",
                    "description": "Examining the impact of changes in the objective function parameters on the selection of variables within an optimal solution.",
                    "lectures": [
                        "9c83bfa8-d773-4ace-b84a-21f7d814b33c"
                    ],
                    "children": []
                },
                {
                    "id": "3c5e726d-8b44-48d6-9f6e-5f5783d73a81",
                    "keyword": "Constraint Parameter Variations",
                    "description": "Evaluating how fluctuations in the constraint parameters alter the optimal solution and the range of feasibility of a linear programming problem.",
                    "lectures": [
                        "9c83bfa8-d773-4ace-b84a-21f7d814b33c"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "725db149-10c3-4844-8111-416bbbfd152b",
            "keyword": "Duality Sensitivity Analysis",
            "description": "Analyzing how changes in the problem's constraints affect the optimal solution in linear programming, focusing on the relationship between primal and dual problems.",
            "lectures": [
                "dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"
            ],
            "children": [
                {
                    "id": "1b8d5a17-9785-4641-99d5-b740cf018b57",
                    "keyword": "Primal-Dual Relationship",
                    "description": "The fundamental connection between a maximization problem (primal) and its corresponding minimization problem (dual) in linear programming.",
                    "lectures": [
                        "dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"
                    ],
                    "children": []
                },
                {
                    "id": "af39db81-42b6-4177-85bc-bc2d204e01a3",
                    "keyword": "Sensitivity Analysis Techniques",
                    "description": "Methods to evaluate how changes in constraints or objective function coefficients impact the optimal solution of a linear program.",
                    "lectures": [
                        "dcc06a69-f8f1-4b75-b9ca-cecd6c82ba90"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "c9a36737-f5d0-4fc2-998a-3bd66c64801f",
            "keyword": "Dual Simplex Matrix",
            "description": "The Dual Simplex Matrix is a specialized method within linear programming that is used when the initial solution isn't feasible but the dual problem is.",
            "lectures": [
                "4bcb992c-ced5-454f-83c0-9478e6183b62"
            ],
            "children": [
                {
                    "id": "380d6337-0d5d-4b4e-8514-145b4475c587",
                    "keyword": "Simplex Method Variations",
                    "description": "The Simplex Method has variations like the Dual Simplex Method and Phase I Algorithm used when initial solutions aren't feasible.",
                    "lectures": [
                        "4bcb992c-ced5-454f-83c0-9478e6183b62"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "d1201ff9-ef01-4d32-ab29-534db0a80c81",
            "keyword": "Convex Analysis",
            "description": "Convex analysis studies convex sets, convex combinations, convex hulls, and separation theorems, providing a foundation for solving optimization problems in linear programming.",
            "lectures": [
                "b1f987e0-f002-4932-b835-3ad3ade23b22"
            ],
            "children": [
                {
                    "id": "0138ed07-b462-4734-a054-7d34672677fc",
                    "keyword": "Convex Sets & Combinations",
                    "description": "Convex sets and combinations form the basis of convex analysis, defining sets and their relationships with the points they contain.",
                    "lectures": [
                        "b1f987e0-f002-4932-b835-3ad3ade23b22"
                    ],
                    "children": []
                },
                {
                    "id": "ce72997c-645d-47d2-b396-834cb4193493",
                    "keyword": "Separation Theorems & Convex Hulls",
                    "description": "Separation theorems and convex hulls are powerful tools for analyzing and solving optimization problems involving convex sets and their separation.",
                    "lectures": [
                        "b1f987e0-f002-4932-b835-3ad3ade23b22"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "13e73f95-2892-4ebf-8f49-a6ccdda96f0e",
            "keyword": "Farkas Lemma",
            "description": "The Farkas Lemma is a fundamental result in linear optimization and duality theory that establishes a relationship between the solvability of a system of linear inequalities and the existence of a particular solution.",
            "lectures": [
                "b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"
            ],
            "children": [
                {
                    "id": "726374ca-030e-4718-8ca0-583489968889",
                    "keyword": "Feasibility",
                    "description": "A condition in the Farkas Lemma where a non-negative solution `x` exists to satisfy the inequalities `Ax ≤ b`.",
                    "lectures": [
                        "b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"
                    ],
                    "children": []
                },
                {
                    "id": "14635b8a-c4c3-4029-b0de-6dbbb0e9533e",
                    "keyword": "Infeasibility",
                    "description": "A condition in the Farkas Lemma where there exists a solution `y` satisfying `yᵀA ≥ 0` and `yᵀb < 0`, indicating the original system is not solvable.",
                    "lectures": [
                        "b1c3b0cf-1b3a-407c-8f0d-32cf24c42f96"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "c8ec7361-de61-420d-a178-004bb0f7f5cd",
            "keyword": "Integer Programming",
            "description": "Integer programming is a type of optimization problem in which some or all variables must be integer values, a critical extension of standard linear programming.",
            "lectures": [
                "866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"
            ],
            "children": [
                {
                    "id": "d12427a5-1bfe-4fc0-988c-e84be53e57e8",
                    "keyword": "Branch-and-Bound Method",
                    "description": "The branch-and-bound method systematically explores the solution space of integer programs by creating subproblems and bounding them to quickly eliminate portions of the solution space that cannot lead to better solutions.",
                    "lectures": [
                        "866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"
                    ],
                    "children": []
                },
                {
                    "id": "407cce6e-2b66-48a2-86a0-819317072aa6",
                    "keyword": "Gomory Cuts",
                    "description": "Gomory cuts are a specific technique used to generate constraints in integer programming, used to refine the feasible region and force the solution to integer values.",
                    "lectures": [
                        "866ea1ec-8c7b-4802-bbb4-2ad5a0a2ee81"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "793f7663-9a71-4aaa-9f66-6f3b39462322",
            "keyword": "Network Flow",
            "description": "Network flow is a linear programming approach to optimize the movement of goods or information through a network of interconnected points.",
            "lectures": [
                "b07f46a7-cbf0-41b4-823a-4e8374f61b01"
            ],
            "children": [
                {
                    "id": "54c99bd1-c726-465e-bab6-92186acaa429",
                    "keyword": "Formulation as a Linear Program",
                    "description": "Network flow problems can be mathematically expressed as optimization problems with linear objective functions and constraints.",
                    "lectures": [
                        "b07f46a7-cbf0-41b4-823a-4e8374f61b01"
                    ],
                    "children": []
                },
                {
                    "id": "5b4c6d83-7998-43b7-8a4d-135430efd9c7",
                    "keyword": "Spanning Trees and Optimality",
                    "description": "Spanning trees are crucial to finding solutions to network flow problems, often serving as starting points for optimization algorithms.",
                    "lectures": [
                        "b07f46a7-cbf0-41b4-823a-4e8374f61b01"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "7b704280-b492-45e1-8d45-fcb7e5a23df6",
            "keyword": "Network Applications",
            "description": "Network applications in linear programming involve optimizing resource flow through networks, encompassing problems like transportation and shortest paths.",
            "lectures": [
                "f242d8c5-a635-4384-b3bb-ed7a94a9b980"
            ],
            "children": [
                {
                    "id": "2d8efeb8-a37f-4b9e-9edc-a66ceeddba80",
                    "keyword": "Transportation Problems",
                    "description": "Transportation problems focus on minimizing the cost of transporting resources from origins to destinations, given constraints on supply and demand.",
                    "lectures": [
                        "f242d8c5-a635-4384-b3bb-ed7a94a9b980"
                    ],
                    "children": []
                },
                {
                    "id": "169a0e69-2770-4bc0-bb91-bb749fe9c282",
                    "keyword": "Shortest Path Problems",
                    "description": "Shortest path problems aim to find the optimal route between two points in a network, considering various factors like distance or cost.",
                    "lectures": [
                        "f242d8c5-a635-4384-b3bb-ed7a94a9b980"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "0bf3f829-7f63-44e3-9d08-de06d8916d07",
            "keyword": "Linear Regression",
            "description": "A method for modeling the relationship between a dependent variable and one or more independent variables.",
            "lectures": [
                "fb8a8493-d3e8-4197-81dd-fd398b8080fb"
            ],
            "children": [
                {
                    "id": "efbdc99f-37de-4ee5-8d0d-19f660b220c9",
                    "keyword": "Regression Techniques",
                    "description": "Different methods of calculating estimates for a regression line, like mean, median, and mid-range.",
                    "lectures": [
                        "fb8a8493-d3e8-4197-81dd-fd398b8080fb"
                    ],
                    "children": []
                },
                {
                    "id": "c012871c-29b2-4c9e-b733-29fd08d96a97",
                    "keyword": "Linear Models",
                    "description": "Using linear equations to find coefficients that best fit a set of input variables to a dependent variable.",
                    "lectures": [
                        "fb8a8493-d3e8-4197-81dd-fd398b8080fb"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "4e0e12a9-fc38-442c-b803-b4d4bb5b9f2a",
            "keyword": "Binary Classification and Geometric Optimization",
            "description": "A method for assigning data points into two categories through geometric optimization using separating lines or hyperplanes.",
            "lectures": [
                "fb8a8493-d3e8-4197-81dd-fd398b8080fb"
            ],
            "children": [
                {
                    "id": "291357cf-6321-4990-a57a-70be5ff21bff",
                    "keyword": "Data Separation",
                    "description": "Finding the optimal separating line or hyperplane to distinguish between different data categories.",
                    "lectures": [
                        "fb8a8493-d3e8-4197-81dd-fd398b8080fb"
                    ],
                    "children": []
                },
                {
                    "id": "d92c4c52-f16c-4e9a-88c9-7892a835480d",
                    "keyword": "Geometric Optimization",
                    "description": "Techniques for finding the best geometric solution, often maximizing or minimizing distance between classes using visual methods.",
                    "lectures": [
                        "fb8a8493-d3e8-4197-81dd-fd398b8080fb"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "f9213aa6-9281-4b74-97fc-e40d86e7c688",
            "keyword": "Linear Programming Applications",
            "description": "Practical applications of linear programming, including examples in production planning, portfolio optimization, and integer programming.",
            "lectures": [
                "6a3bce7c-84d0-438b-8428-c5a79d404f85"
            ],
            "children": [
                {
                    "id": "29058f51-395e-4bee-997e-f1fe390ca724",
                    "keyword": "Production Planning",
                    "description": "Optimizing production levels to meet fluctuating demand, often considering factors like storage and production change costs.",
                    "lectures": [
                        "6a3bce7c-84d0-438b-8428-c5a79d404f85"
                    ],
                    "children": []
                },
                {
                    "id": "8ae602d8-247c-4302-a5d6-60253c6f9095",
                    "keyword": "Portfolio Selection",
                    "description": "Maximizing investment returns while managing risk by optimizing the allocation of resources across different investment options.",
                    "lectures": [
                        "6a3bce7c-84d0-438b-8428-c5a79d404f85"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "84150dcb-ad5f-4d5b-b163-730b861bb963",
            "keyword": "Integer Programming Examples",
            "description": "Linear programming techniques extended to problems requiring integer solutions, addressing discrete choices in areas like scheduling and resource allocation.",
            "lectures": [
                "6a3bce7c-84d0-438b-8428-c5a79d404f85"
            ],
            "children": [
                {
                    "id": "e52af2d6-e138-4715-a10a-3d84b725bae0",
                    "keyword": "Maximum Weight Matching",
                    "description": "Optimizing the assignment of tasks or resources to achieve the best outcome in terms of weighted matches.",
                    "lectures": [
                        "6a3bce7c-84d0-438b-8428-c5a79d404f85"
                    ],
                    "children": []
                },
                {
                    "id": "0adfad77-7f84-4040-8f9b-d460fdc1d44c",
                    "keyword": "Machine Scheduling and Knapsack Problems",
                    "description": "Application of integer programming in scheduling tasks on multiple machines and optimizing resource allocation in constrained scenarios, like packing a knapsack.",
                    "lectures": [
                        "6a3bce7c-84d0-438b-8428-c5a79d404f85"
                    ],
                    "children": []
                }
            ]
        },
        {
            "id": "7bc7dfb6-030b-4235-8333-d333f3bfe65b",
            "keyword": "Network Simplex",
            "description": "The Network Simplex method is a specialized algorithm for linear programming problems with network structures, leveraging spanning trees to optimize flow.",
            "lectures": [
                "0ce8c393-2665-4132-ae76-5b409dc704e6"
            ],
            "children": [
                {
                    "id": "596182d7-4a36-4d43-b723-3c6cee97cb8e",
                    "keyword": "Spanning Tree Optimization",
                    "description": "Spanning trees are crucial to the network simplex method for efficiently iteratively optimizing primal and dual flows.",
                    "lectures": [
                        "0ce8c393-2665-4132-ae76-5b409dc704e6"
                    ],
                    "children": []
                }
            ]
        }
    ]
}



export const LINEAR_PROGRAMMING_V2_MAP: MapNode = { 'keyword': 'Linear Programming', 'description': 'Linear programming is a mathematical method for optimizing a linear objective function subject to linear constraints.', 'children': [{ 'keyword': 'Network Flow', 'description': 'Network flow is a system of interconnected nodes and arcs representing a network, where flow refers to the movement of something along the arcs.', 'children': [{ 'keyword': 'Spanning Trees', 'description': 'A spanning tree is a subset of arcs that connects all nodes without forming any cycles, crucial for finding basic solutions in network flow problems.', 'id': 'e765098f-9508-4f21-9142-a8320a290877' }, { 'keyword': 'Primal and Dual Variables', 'description': 'Primal and dual variables represent flow and costs in the network, linked by complementary slackness in an optimal solution.', 'id': '819fbd9d-c86b-4621-90b7-c26eb70e4bfe' }], 'id': '8d7e7b32-1adf-47d2-a1b5-2ababa9ccb8d' }, { 'keyword': 'Farkas Lemma', 'description': 'The Farkas Lemma is a theorem in linear algebra and optimization that provides a way to determine if a system of linear inequalities has a solution.', 'children': [{ 'keyword': 'Linear Inequality', 'description': 'A linear inequality is an inequality involving linear expressions.', 'id': '9591ea0b-c56d-4262-b412-326a8926bf6c' }, { 'keyword': 'Linear Programming', 'description': 'Linear programming is a mathematical method for optimizing a linear objective function subject to linear constraints.', 'id': 'ce3e5e5b-a628-4437-bc9a-55c3dc04eb32' }], 'id': '71f9ed3b-7621-402f-a93f-4ba56c6850cc' }, { 'keyword': 'Linear Regression', 'description': 'Linear regression is a statistical method used to model the relationship between a dependent variable and one or more independent variables, aiming to find a function that best predicts the dependent variable given the independent variables.', 'children': [{ 'keyword': 'Least Squares', 'description': 'Least squares is a method within regression that minimizes the sum of the squared differences between observed and predicted values.', 'id': '6ae6c24e-813f-4812-8c63-e8fdb025b07c' }, { 'keyword': 'Binary Classification', 'description': 'Binary classification is a type of supervised machine learning where the goal is to categorize data points into two distinct classes.', 'id': 'c1c0ce1a-5a2b-452f-8c26-359332647bbb' }], 'id': 'f3eb14c7-228c-4dcc-8004-4201bec04860' }, { 'keyword': 'Integer Programming', 'description': 'Integer programming is a type of optimization problem where some or all of the decision variables must take integer values.', 'children': [{ 'keyword': 'Branch and Bound', 'description': 'Branch and bound is a systematic search algorithm for integer programming that explores possible solutions by branching on fractional variables and bounding the search space.', 'id': '378fafd5-afa7-47c0-a9ce-d2f126c3090b' }, { 'keyword': 'Gomory Cuts', 'description': 'Gomory cuts are constraints derived from the fractional parts of the linear programming relaxation solution to eliminate fractional solutions while preserving the feasible region for integer solutions.', 'id': '39ecaf1c-464f-471a-9310-2f0b819d946b' }], 'id': '09abad20-d40e-4bac-924c-428147e47e6b' }, { 'keyword': 'Convex Analysis', 'description': "Convex analysis is the study of convex sets, convex hulls, and the separation theorem, with Farkas' Lemma as a crucial tool in linear programming.", 'children': [{ 'keyword': 'Convex Set', 'description': 'A convex set is a set where any line segment connecting two points in the set lies entirely within the set.', 'id': 'd5c01148-befe-40e5-b4ca-e061a1c1a701' }, { 'keyword': 'Convex Hull', 'description': 'The convex hull is the smallest convex set containing a given set of points.', 'id': '34cf36e2-a1f3-4da7-a41f-31d512fb924b' }], 'id': '960cce20-5e90-437c-aafb-47cf31b0fead' }], 'id': 'a7f72e24-7014-418b-842c-8af63568e083' }




export const LINEAR_PROGRAMMING_MAP: MapNode = {
	"id": "8a2f987a-563f-432a-a85f-1234567890ab",
	"keyword": "Linear Programming",
	"children": [
		{
			"id": "12345678-90ab-cdef-0123-4567890abcdef",
			"keyword": "Regression Analysis",
			"children": [
				{
					"id": "91234567-89ab-cdef-0123-4567890abcdef",
					"keyword": "Linear Regression",
					"children": [
						{ "id": "11111111-2222-3333-4444-555555555555", "keyword": "Least Squares" },
						{ "id": "22222222-3333-4444-5555-666666666666", "keyword": "Error Functions (L1, L2, L∞)" },
						{ "id": "33333333-4444-5555-6666-777777777777", "keyword": "Normal Equations" }
					]
				},
				{
					"id": "abcdeffed-cba9-8765-4321-098765432100",
					"keyword": "Other Regression Techniques"
				}
			]
		},
		{
			"id": "abcdef01-2345-6789-0123-4567890abcdef",
			"keyword": "Binary Classification",
			"children": [
				{
					"id": "fedcba98-7654-3210-9876-543210987654",
					"keyword": "Hyperplane Separation",
					"children": [
						{ "id": "12345678-90ab-cdef-0123-4567890abcdef", "keyword": "Maximizing Margin" }
					]
				}
			]
		},
		{
			"id": "09876543-2109-8765-4321-098765432100",
			"keyword": "Integer Programming",
			"children": [
				{ "id": "11111111-2222-3333-4444-555555555555", "keyword": "Branch and Bound" },
				{ "id": "22222222-3333-4444-5555-666666666666", "keyword": "Gomory Cuts" }
			]
		},
		{
			"id": "12345678-90ab-cdef-0123-4567890abcdef",
			"keyword": "Convex Analysis",
			"children": [
				{ "id": "91234567-89ab-cdef-0123-4567890abcdef", "keyword": "Convex Sets" },
				{ "id": "abcdeffed-cba9-8765-4321-098765432100", "keyword": "Convex Hulls" },
				{ "id": "fedcba98-7654-3210-9876-543210987654", "keyword": "Separation Theorem" },
				{ "id": "12345678-90ab-cdef-0123-4567890abcdef", "keyword": "Farkas' Lemma" }
			]
		},
		{
			"id": "09876543-2109-8765-4321-098765432100",
			"keyword": "Network Flow",
			"children": [
				{ "id": "11111111-2222-3333-4444-555555555555", "keyword": "Spanning Trees" },
				{ "id": "22222222-3333-4444-5555-666666666666", "keyword": "Primal and Dual Variables" },
				{ "id": "33333333-4444-5555-6666-777777777777", "keyword": "Complementary Slackness" }
			]
		}
	]
}