/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', "class"],
  theme: {
  	extend: {
  		colors: {
  			background: 'var(--background)',
  			foreground: 'var(--foreground)',
  			card: {
  				DEFAULT: 'var(--card)',
  				foreground: 'var(--card-foreground)'
  			},
  			popover: {
  				DEFAULT: 'var(--popover)',
  				foreground: 'var(--popover-foreground)'
  			},
  			primary: {
  				DEFAULT: 'var(--primary)',
  				foreground: 'var(--primary-foreground)'
  			},
  			secondary: {
  				DEFAULT: 'var(--secondary)',
  				foreground: 'var(--secondary-foreground)'
  			},
  			muted: {
  				DEFAULT: 'var(--muted)',
  				foreground: 'var(--muted-foreground)'
  			},
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'var(--accent-foreground)'
  			},
  			destructive: {
  				DEFAULT: 'var(--destructive)',
  				foreground: 'var(--destructive-foreground)'
  			},
  			border: 'var(--border)',
  			input: 'var(--input)',
  			ring: 'var(--ring)',
  			sidebar: {
  				DEFAULT: 'var(--sidebar)',
  				foreground: 'var(--sidebar-foreground)',
  				primary: 'var(--sidebar-primary)',
  				'primary-foreground': 'var(--sidebar-primary-foreground)',
  				accent: 'var(--sidebar-accent)',
  				'accent-foreground': 'var(--sidebar-accent-foreground)',
  				border: 'var(--sidebar-border)',
  				ring: 'var(--sidebar-ring)'
  			},
  			boysenberry: {
  				DEFAULT: 'var(--boysenberry)',
  				light: 'var(--boysenberry-light)',
  				dark: 'var(--boysenberry-dark)'
  			},
  			goldenBell: {
  				DEFAULT: 'var(--golden-bell)'
  			},
  			cashmere: {
  				DEFAULT: 'var(--cashmere)'
  			},
  			pesto: {
  				DEFAULT: 'var(--pesto)'
  			},
  			seafoam: {
  				DEFAULT: 'var(--seafoam)'
  			},
  			teal: {
  				DEFAULT: 'var(--teal)',
  				light: 'var(--teal-light)',
  				dark: 'var(--teal-dark)'
  			},
  			rag: {
  				red: 'var(--rag-red)',
  				amber: 'var(--rag-amber)',
  				green: 'var(--rag-green)',
  				na: 'var(--rag-na)'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			outfit: [
  				'Outfit',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			h1: 'var(--text-h1)',
  			h2: 'var(--text-h2)',
  			h3: 'var(--text-h3)',
  			body: 'var(--text-body)',
  			small: 'var(--text-small)',
  			tiny: 'var(--text-tiny)'
  		},
  		spacing: {
  			'space-1': 'var(--space-1)',
  			'space-2': 'var(--space-2)',
  			'space-3': 'var(--space-3)',
  			'space-4': 'var(--space-4)',
  			'space-5': 'var(--space-5)',
  			'space-6': 'var(--space-6)',
  			'space-8': 'var(--space-8)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			xl: 'calc(var(--radius) + 4px)'
  		},
  		boxShadow: {
  			card: 'var(--shadow-card)',
  			hover: 'var(--shadow-hover)',
  			modal: 'var(--shadow-modal)'
  		},
  		transitionDuration: {
  			fast: '150ms',
  			normal: '200ms',
  			slow: '300ms'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
