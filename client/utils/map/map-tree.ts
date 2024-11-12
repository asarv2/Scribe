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