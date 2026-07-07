import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  description?: string;
}

export const StatCard = ({ title, value, icon: Icon, trend, trendLabel, description }: StatCardProps) => {
  const isPositiveTrend = trend && trend > 0;
  const isNegativeTrend = trend && trend < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl sm:text-3xl font-bold text-foreground">{value}</div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {isPositiveTrend && <TrendingUp className="h-4 w-4 text-green-600" />}
            {isNegativeTrend && <TrendingDown className="h-4 w-4 text-red-600" />}
            <p
              className={cn(
                "text-xs font-medium",
                isPositiveTrend && "text-green-600",
                isNegativeTrend && "text-red-600",
                !isPositiveTrend && !isNegativeTrend && "text-muted-foreground"
              )}
            >
              {trend > 0 ? "+" : ""}{trend}% {trendLabel}
            </p>
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};
