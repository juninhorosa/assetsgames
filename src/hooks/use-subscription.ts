import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth.tsx";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export type PlanId = "apprentice_plan" | "artisan_plan" | "architect_plan";

export interface SubscriptionRow {
  product_id: string;
  price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  paddle_subscription_id: string;
  paddle_customer_id: string;
  environment: string;
}

export function useSubscription() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["subscription", user?.id, getPaddleEnvironment()],
    enabled: !!user,
    queryFn: async (): Promise<SubscriptionRow | null> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "product_id, price_id, status, current_period_end, cancel_at_period_end, paddle_subscription_id, paddle_customer_id, environment",
        )
        .eq("user_id", user!.id)
        .eq("environment", getPaddleEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as SubscriptionRow | null) ?? null;
    },
  });

  const sub = query.data ?? null;
  const periodOk = !sub?.current_period_end || new Date(sub.current_period_end) > new Date();
  const isActive =
    !!sub &&
    periodOk &&
    ["active", "trialing", "past_due", "canceled"].includes(sub.status) &&
    !(sub.status === "canceled" && !sub.current_period_end);

  return {
    subscription: sub,
    isActive,
    isPastDue: sub?.status === "past_due",
    plan: (sub?.product_id ?? null) as PlanId | null,
    isLoading: query.isLoading,
  };
}
