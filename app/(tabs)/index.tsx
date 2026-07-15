import { ScrollView, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";

import { WeekSpendChart } from "@/components/burnrate/week-spend-chart";
import {
  BodyText,
  Card,
  Label,
  ProgressBar,
  Screen,
  AnimatedValueText,
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
  const router = useRouter();
  const { summary, } = useBurnrateStore();
  const runwayTone =
    summary.runwayDays !== null && summary.runwayDays < 7 ? "blush" : "peach";
  const runway = formatRunwayParts(summary.runwayDays);
  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: 12, padding: 14, paddingBottom: 140 }}
      >

        {/* Balance card — structure, graphics, and position preserved */}
        <Card tone="panel" style={{ aspectRatio: "16/9" }}>
          <View style={{ gap: 14, zIndex: 10 }}>
            <Label style={{ fontWeight: "bold" }}>Balance</Label>
            <AnimatedValueText value={summary.balancePaise} formatter={formatInr} />
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

        <View style={{ flexDirection: "row", gap: 10, height: 108 }}>
          <Card
            tone={runwayTone}
            shape="organic-left"
            showHandle={false}
            favoriteKey="runway"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "flex-start",
              paddingVertical: 8,
            }}
          >
            <Label dark>Runway</Label>
            <View
              style={{
                marginTop: 2,
                gap: 2,
                alignItems: "center",
              }}
            >
              <Text
                selectable
                style={{
                  color: palette.ink,
                  fontSize: 28,
                  fontWeight: "600",
                  letterSpacing: -0.6,
                  textAlign: "center",
                  lineHeight: 34,
                }}
              >
                {runway.value}
              </Text>
              <Text
                style={{
                  color: "rgba(10,10,10,0.5)",
                  fontSize: 11,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  fontFamily: "monospace",
                }}
              >
                {runway.unit}
              </Text>
            </View>
          </Card>

          <Card
            tone="blush"
            shape="organic-right"
            showHandle={false}
            favoriteKey="month"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "flex-start",
              paddingVertical: 8,
            }}
          >
            <Label dark>This month</Label>
            <View
              style={{
                marginTop: 2,
                gap: 1,
                alignItems: "center",
              }}
            >
              <Text
                selectable
                style={{
                  color: palette.ink,
                  fontSize: 28,
                  fontWeight: "600",
                  letterSpacing: -0.6,
                  textAlign: "center",
                  lineHeight: 34,
                }}
              >
                {formatInr(summary.monthSpendPaise)}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  fontFamily: "monospace",
                }}
              >
                <Text
                  style={{
                    color: "#111", // darker
                    fontWeight: "800", // bolder
                  }}
                >
                  {formatInr(summary.dailyBurnPaise)}
                </Text>

                <Text
                  style={{
                    color: "rgba(10,10,10,0.5)",
                    fontWeight: "600",
                  }}
                >
                  {" "} / day
                </Text>
              </Text>
            </View>
          </Card>
        </View>

        <Card style={{ overflow: "visible", zIndex: 10 }}>
          <WeekSpendChart
            days={summary.weekDays ?? []}
            totalPaise={summary.weekSpendPaise ?? 0}
            weekAvgDailyPaise={summary.weekAvgDailyPaise ?? 0}
          />
        </Card>

        <Card tone="lemon">
          <Label dark>Where it went</Label>
          {summary.categoryBreakdown.length === 0 ? (
            <BodyText dark muted>
              Add expenses to see category share.
            </BodyText>
          ) : (
            summary.categoryBreakdown.slice(0, 4).map((item) => (
              <Pressable
                key={item.category}
                style={({ pressed }) => ({ gap: 7, opacity: pressed ? 0.7 : 1 })}
                onPress={() => {
                  router.push(`/transactions?filterCategory=${encodeURIComponent(item.category)}`);
                }}
              >
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
              </Pressable>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
