import { ScrollView, Text, View } from "react-native";
import type { ReactNode } from "react";

import {
  BodyText,
  Card,
  Label,
  Pill,
  ProgressBar,
  Screen,
  ValueText,
  palette,
} from "@/components/burnrate/ui";
import { formatInr } from "@/features/burnrate/calculations";
import { useBurnrateStore } from "@/features/burnrate/store";
import { IconSymbol } from "@/components/ui/icon-symbol";

function formatRunwayParts(days: number | null): {
  value: string;
  unit: string;
} {
  if (days === null) return { value: "—", unit: "no burn yet" };
  if (days > 365) return { value: "1y", unit: "plus" };
  return { value: `${Math.max(0, Math.floor(days))}`, unit: "days" };
}

export default function DashboardScreen() {
  const { isLoading, summary } = useBurnrateStore();
  const runwayTone =
    summary.runwayDays !== null && summary.runwayDays < 7 ? "coral" : "gold";
  const runway = formatRunwayParts(summary.runwayDays);

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 140 }}
      >
        <Card tone="panel" style={{ aspectRatio: "16/9" }}>
          <View style={{ gap: 14, zIndex: 10 }}>
            <Label style={{ fontWeight: "bold" }}>Balance</Label>
            <ValueText>{formatInr(summary.balancePaise)}</ValueText>
          </View>
          <IconSymbol
            name="bank"
            size={48}
            style={{
              position: "absolute",
              right: 16,
              bottom: 12,
              zIndex: 9,
              opacity: 0.3,
            }}
            color={palette.paper}
            weight="bold"
          />
        </Card>

        <View style={{ flexDirection: "row", gap: 12, height: 124 }}>
          <Card
            tone={runwayTone}
            shape="organic-left"
            showHandle={false}
            favoriteKey="runway"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "flex-start",
              paddingVertical: 16,
            }}
          >
            <Label dark>Runway</Label>
            <View
              style={{
                marginTop: 8,
                gap: 2,
                alignItems: "center",
              }}
            >
              <Text
                selectable
                style={{
                  color: palette.ink,
                  fontSize: 28,
                  fontWeight: "900",
                  textAlign: "center",
                  lineHeight: 34,
                }}
              >
                {runway.value}
              </Text>
              <Text
                style={{
                  color: "#4C3A2E",
                  fontSize: 11,
                  fontWeight: "900",
                  textTransform: "uppercase",
                  opacity: 0.6,
                }}
              >
                {runway.unit}
              </Text>
            </View>
          </Card>

          <Card
            tone="coral"
            shape="organic-right"
            showHandle={false}
            favoriteKey="month"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "flex-start",
              paddingVertical: 16,
            }}
          >
            <Label dark>This month</Label>
            <View
              style={{
                marginTop: 8,
                gap: 1,
                alignItems: "center",
              }}
            >
              <Text
                selectable
                style={{
                  color: palette.ink,
                  fontSize: 28,
                  fontWeight: "900",
                  textAlign: "center",
                  lineHeight: 34,
                }}
              >
                {formatInr(summary.monthSpendPaise)}
              </Text>
              <Text
                style={{
                  color: "#4C3A2E",
                  fontSize: 11,
                  fontWeight: "900",
                  textTransform: "uppercase",
                  opacity: 0.6,
                }}
              >
                {formatInr(summary.dailyBurnPaise)} / day
              </Text>
            </View>
          </Card>
        </View>

        <Card>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Label>Budget pulse</Label>
            <Pill>{summary.budgetWarnings.length ? "Watch" : "Calm"}</Pill>
          </View>
          {summary.budgetWarnings.length === 0 ? (
            <BodyText muted>
              {isLoading ? "Loading..." : "No category is over 80% this month."}
            </BodyText>
          ) : (
            summary.budgetWarnings.map((warning) => (
              <View key={warning.category} style={{ gap: 7 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <BodyText>{warning.category}</BodyText>
                  <BodyText muted>
                    {formatInr(warning.spentPaise)} /{" "}
                    {formatInr(warning.limitPaise)}
                  </BodyText>
                </View>
                <ProgressBar
                  progress={warning.ratio}
                  tone={warning.level === "breached" ? "bad" : "default"}
                />
              </View>
            ))
          )}
        </Card>

        <Card tone="cream">
          <Label dark>Where it went</Label>
          {summary.categoryBreakdown.length === 0 ? (
            <BodyText dark muted>
              Add expenses to see category share.
            </BodyText>
          ) : (
            summary.categoryBreakdown.slice(0, 4).map((item) => (
              <View key={item.category} style={{ gap: 7 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <BodyText dark>{item.category}</BodyText>
                  <BodyText dark muted>
                    {formatInr(item.amountPaise)}
                  </BodyText>
                </View>
                <ProgressBar dark progress={item.share} />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
