// Configuration commune pour tous les graphiques Recharts
export const defaultChartConfig = {
  margin: { top: 20, right: 30, left: 20, bottom: 5 },
};

export const chartColors = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  success: 'hsl(142, 76%, 36%)',
  warning: 'hsl(38, 92%, 50%)',
  danger: 'hsl(0, 84%, 60%)',
  blue: 'hsl(217, 91%, 60%)',
  green: 'hsl(142, 76%, 36%)',
  orange: 'hsl(38, 92%, 50%)',
  purple: 'hsl(271, 76%, 53%)',
};

export const tooltipStyles = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
  },
  labelStyle: {
    color: 'hsl(var(--foreground))',
  },
};
