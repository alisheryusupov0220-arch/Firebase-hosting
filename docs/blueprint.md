# **App Name**: Dog&Dog Invent+

## Core Features:

- Supply Recording: Record supply поступления, specifying items and quantities.
- Write-off Recording: Record списания of items, noting the reasons for списания.
- Transfer Recording: Record перемещения of inventory between locations.
- Inventory Recording: Perform инвентаризаций to update stock levels.
- Poster API Integration: Connect with the Poster system to automatically update stock levels.
- Category Sync: Automatically synchronize categories from Poster.

## Style Guidelines:

- Background: HSL 210 20% 95% in light mode, HSL 210 20% 5% in dark mode; RGB(242, 242, 247) in light mode, RGB(13, 13, 13) in dark mode.
- Foreground: HSL 210 20% 10% in light mode, HSL 210 20% 98% in dark mode; RGB(25, 25, 26) in light mode, RGB(249, 249, 251) in dark mode.
- Card Background: HSL 210 20% 100% in light mode, HSL 210 20% 10% in dark mode; RGB(255, 255, 255) in light mode, RGB(25, 25, 26) in dark mode.
- Primary: HSL 210 60% 50% in both light and dark modes; RGB(0, 119, 255).
- Body font: 'Inter', sans-serif.
- Headline font: 'Space Grotesk', sans-serif.
- Code font: 'Source Code Pro', monospace.
- Use the AppLayout structure with a fixed header, main content area, and a PageHeader component for page titles.
- Employ Card components from shadcn/ui for content blocks, featuring a visible border, slight shadow, and rounded corners.
- Utilize the MainNav component with icons and labels, highlighting the active menu item with the accent color.
- Use icons from the lucide-react library for a consistent visual language.