export type MapNode = {
	id: string
	color?: string
	keyword: string
	description?: string
	children?: MapNode[]
}

export type FlatMapNode = {
	id: string
	keyword: string
	color?: string
	description?: string
	parentId?: string
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