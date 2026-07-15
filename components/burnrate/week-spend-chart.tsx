import { Text, View, Pressable } from "react-native";
import { useState } from "react";
import * as Haptics from "expo-haptics";

import { BodyText, palette } from "@/components/burnrate/ui";
import {
  formatChartScale,
  getCategoryChartColor,
} from "@/features/burnrate/calculations";
import type { WeekDayCategorySpend, WeekDaySpend } from "@/features/burnrate/types";

const CHART_HEIGHT = 140;
const SCALE_WIDTH = 44;
const SCALE_TICKS = 4;
const BAR_WIDTH = "78%";
const BAR_MAX_WIDTH = 34;
const SEGMENT_GAP = 1;
const SEGMENT_RADIUS = 7;
const MIN_SEGMENT_PX = 6;
const AVG_DOT_COUNT = 28;
const AVG_DOT_SIZE = 2;
const AVG_DOT_GAP = 4;

// Tooltip sizing constants — used to compute how far above the bar
// the breakdown card needs to sit so it never overlaps the plot.
const TOOLTIP_ROW_HEIGHT = 16;
const TOOLTIP_ROW_GAP = 4;
const TOOLTIP_DIVIDER_BLOCK = 9; // 1px line + 4px margin top/bottom
const TOOLTIP_VERTICAL_PADDING = 16; // 8 top + 8 bottom
const TOOLTIP_MARGIN_FROM_BAR = 10;

type Props = {
  days: WeekDaySpend[];
  totalPaise: number;
  weekAvgDailyPaise?: number;
};

function segmentHeightsPx(
  segments: WeekDayCategorySpend[],
  barHeight: number,
): number[] {
  const n = segments.length;
  if (n === 0 || barHeight <= 0) return [];

  const gaps = SEGMENT_GAP * Math.max(0, n - 1);
  const available = Math.max(n * MIN_SEGMENT_PX, barHeight - gaps);
  const total = segments.reduce((sum, s) => sum + s.amountPaise, 0);
  if (total <= 0) return segments.map(() => MIN_SEGMENT_PX);

  // Raw proportional heights
  const raw = segments.map((s) => (s.amountPaise / total) * available);

  // Enforce minimum, then re-normalize remaining space so sum === available
  const floors = raw.map((h) => Math.max(MIN_SEGMENT_PX, h));
  const floorSum = floors.reduce((a, b) => a + b, 0);

  if (floorSum <= available) {
    // Distribute leftover by original share among segments above floor
    let leftover = available - floorSum;
    const result = floors.map((h, i) => {
      if (leftover <= 0) return Math.round(h);
      const extra = (raw[i] / available) * leftover;
      return h + extra;
    });
    // Fix rounding so pixel sum matches available
    return normalizePixelHeights(result, available);
  }

  // If mins exceed available, scale all floors down proportionally
  const scale = available / floorSum;
  return normalizePixelHeights(
    floors.map((h) => h * scale),
    available,
  );
}

function normalizePixelHeights(heights: number[], target: number): number[] {
  if (heights.length === 0) return [];
  const rounded = heights.map((h) => Math.max(1, Math.round(h)));
  let diff = target - rounded.reduce((a, b) => a + b, 0);
  // Nudge the largest segments so totals match the bar height exactly
  const order = rounded
    .map((h, i) => ({ h, i }))
    .sort((a, b) => b.h - a.h)
    .map((x) => x.i);

  let guard = 0;
  while (diff !== 0 && guard < 100) {
    const idx = order[guard % order.length];
    if (diff > 0) {
      rounded[idx] += 1;
      diff -= 1;
    } else if (rounded[idx] > 1) {
      rounded[idx] -= 1;
      diff += 1;
    }
    guard += 1;
  }
  return rounded;
}

function StackedCategoryBar({
  segments,
  barHeight,
  isToday,
}: {
  segments: WeekDayCategorySpend[];
  barHeight: number;
  isToday: boolean;
}) {
  const ordered = [...segments].filter((s) => s.amountPaise > 0);
  // Bottom of stack first (base category)
  const heights = segmentHeightsPx(ordered, barHeight);

  return (
    <View
      style={{
        width: BAR_WIDTH,
        maxWidth: BAR_MAX_WIDTH,
        height: barHeight,
        justifyContent: "flex-end",
        alignItems: "stretch",
        gap: SEGMENT_GAP,
      }}
    >
      {/* Render base → top so first category sits on the baseline */}
      {ordered.map((segment, index) => (
        <View
          key={segment.category}
          style={{
            height: heights[index],
            width: "100%",
            borderRadius: SEGMENT_RADIUS,
            backgroundColor: getCategoryChartColor(segment.category),
          }}
        />
      ))}
    </View>
  );
}

/** Horizontal dotted line at the week’s average daily spend. */
function AverageDottedLine({
  avgPaise,
  maxPaise,
}: {
  avgPaise: number;
  maxPaise: number;
}) {
  if (maxPaise <= 0 || avgPaise <= 0) return null;

  // Distance from top of plot (0 at top, CHART_HEIGHT at baseline)
  const topOffset = Math.max(
    0,
    Math.min(
      CHART_HEIGHT - 1,
      Math.round(CHART_HEIGHT - (avgPaise / maxPaise) * CHART_HEIGHT),
    ),
  );

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 6,
        right: 0,
        top: topOffset - 1,
        zIndex: 4,
        height: AVG_DOT_SIZE + 2,
        flexDirection: "row",
        alignItems: "center",
        gap: AVG_DOT_GAP,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: AVG_DOT_COUNT }, (_, i) => (
        <View
          key={`avg-dot-${i}`}
          style={{
            width: AVG_DOT_SIZE,
            height: AVG_DOT_SIZE,
            borderRadius: AVG_DOT_SIZE / 2,
            backgroundColor: "rgba(250, 250, 250, 0.82)",
            flexShrink: 0,
          }}
        />
      ))}
    </View>
  );
}

/** Per-category breakdown card shown above the pressed day's bar. */
function DaySpendBreakdown({
  segments,
  total,
  isFirst,
  isLast,
}: {
  segments: WeekDayCategorySpend[];
  total: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const sorted = [...segments]
    .filter((s) => s.amountPaise > 0)
    .sort((a, b) => b.amountPaise - a.amountPaise);

  const rowCount = sorted.length;
  const height =
    TOOLTIP_VERTICAL_PADDING +
    rowCount * TOOLTIP_ROW_HEIGHT +
    Math.max(0, rowCount - 1) * TOOLTIP_ROW_GAP +
    (rowCount > 0 ? TOOLTIP_DIVIDER_BLOCK : 0) +
    TOOLTIP_ROW_HEIGHT; // total row

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -(height + TOOLTIP_MARGIN_FROM_BAR),
        left: isFirst ? -6 : -16,
        right: isLast ? -6 : -16,
        minWidth: 120,
        alignSelf: "flex-start",
        backgroundColor: palette.surface,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: palette.border,
        zIndex: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
        gap: TOOLTIP_ROW_GAP,
      }}
    >
      {sorted.map((segment) => (
        <View
          key={segment.category}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            height: TOOLTIP_ROW_HEIGHT,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              flexShrink: 1,
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: getCategoryChartColor(segment.category),
                flexShrink: 0,
              }}
            />
            <Text
              style={{
                color: palette.muted,
                fontSize: 10,
                fontFamily: "monospace",
                fontWeight: "600",
              }}
              numberOfLines={1}
            >
              {segment.category}
            </Text>
          </View>
          <Text
            style={{
              color: palette.paper,
              fontSize: 10,
              fontFamily: "monospace",
              fontWeight: "700",
            }}
          >
            {formatChartScale(segment.amountPaise)}
          </Text>
        </View>
      ))}

      {sorted.length > 0 && (
        <View
          style={{
            height: 1,
            backgroundColor: palette.border,
            marginVertical: 2,
          }}
        />
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          height: TOOLTIP_ROW_HEIGHT,
        }}
      >
        <Text
          style={{
            color: palette.muted,
            fontSize: 10,
            fontFamily: "monospace",
            fontWeight: "700",
          }}
        >
          Total
        </Text>
        <Text
          style={{
            color: palette.paper,
            fontSize: 11,
            fontFamily: "monospace",
            fontWeight: "700",
          }}
        >
          {formatChartScale(total)}
        </Text>
      </View>
    </View>
  );
}

export function WeekSpendChart({
  days,
  totalPaise,
  weekAvgDailyPaise,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const maxPaise = Math.max(...days.map((d) => d.amountPaise), 0);
  const hasSpend = totalPaise > 0;
  // Calendar week average only: this week’s total ÷ 7 (Mon–Sun).
  // Do not use dailyBurnPaise (rolling 7-day) or month spend.
  const weekTotalFromBars = days.reduce((sum, d) => sum + d.amountPaise, 0);
  const avgPaise =
    weekAvgDailyPaise != null && weekAvgDailyPaise >= 0
      ? weekAvgDailyPaise
      : Math.round(weekTotalFromBars / 7);

  const weekCategories = Array.from(
    new Set(
      days.flatMap((day) => day.categories?.map((c) => c.category) ?? []),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const scaleValues =
    maxPaise > 0
      ? Array.from({ length: SCALE_TICKS }, (_, i) =>
          Math.round((maxPaise * i) / (SCALE_TICKS - 1)),
        )
      : [0];

  return (
    <View style={{ gap: 12 }}>
      {!hasSpend ? (
        <BodyText muted>No spend logged this week yet.</BodyText>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Left scale */}
            <View
              style={{
                width: SCALE_WIDTH,
                height: CHART_HEIGHT,
                justifyContent: "space-between",
                alignItems: "flex-end",
                paddingRight: 4,
              }}
            >
              {[...scaleValues].reverse().map((value, index) => (
                <Text
                  key={`scale-${index}-${value}`}
                  style={{
                    color: palette.muted,
                    fontSize: 10,
                    fontFamily: "monospace",
                    fontWeight: "600",
                    lineHeight: 12,
                  }}
                  numberOfLines={1}
                >
                  {formatChartScale(value)}
                </Text>
              ))}
            </View>

            {/* Plot */}
            <View style={{ flex: 1, gap: 8 }}>
              <View
                style={{
                  height: CHART_HEIGHT,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 6,
                  borderLeftWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                  paddingLeft: 6,
                  overflow: "visible",
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 6,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    justifyContent: "space-between",
                  }}
                >
                  {scaleValues.map((_, index) => (
                    <View
                      key={`grid-${index}`}
                      style={{
                        height: 1,
                        backgroundColor:
                          index === 0
                            ? "transparent"
                            : "rgba(255,255,255,0.06)",
                      }}
                    />
                  ))}
                </View>

                {/* Avg spend guide — dotted line across the plot */}
                <AverageDottedLine avgPaise={avgPaise} maxPaise={maxPaise} />

                {days.map((day, index) => {
                  const total = day.amountPaise;
                  const barHeight =
                    maxPaise > 0 && total > 0
                      ? Math.max(
                          MIN_SEGMENT_PX,
                          Math.round((total / maxPaise) * CHART_HEIGHT),
                        )
                      : 0;

                  const segments = (day.categories ?? []).filter(
                    (c) => c.amountPaise > 0,
                  );

                  const isSelected = selectedDay === day.dayStart;
                  const isOtherSelected = selectedDay !== null && !isSelected;
                  const isFirst = index === 0;
                  const isLast = index === days.length - 1;

                  return (
                    <Pressable
                      key={day.dayStart}
                      onPressIn={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedDay(day.dayStart);
                      }}
                      onPressOut={() => {
                        setSelectedDay(null);
                      }}
                      style={{
                        flex: 1,
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        opacity: isOtherSelected ? 0.4 : 1,
                      }}
                    >
                      {isSelected && total > 0 && (
                        <DaySpendBreakdown
                          segments={segments}
                          total={total}
                          isFirst={isFirst}
                          isLast={isLast}
                        />
                      )}
                      {total > 0 && segments.length > 0 ? (
                        <StackedCategoryBar
                          segments={segments}
                          barHeight={barHeight}
                          isToday={day.isToday}
                        />
                      ) : (
                        <View
                          style={{
                            width: BAR_WIDTH,
                            maxWidth: BAR_MAX_WIDTH,
                            height: 3,
                            borderRadius: 2,
                            backgroundColor: "rgba(255,255,255,0.08)",
                          }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Day labels */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 6,
                  paddingLeft: 6,
                }}
              >
                {days.map((day) => (
                  <View
                    key={`label-${day.dayStart}`}
                    style={{ flex: 1, alignItems: "center" }}
                  >
                    <Text
                      style={{
                        color: day.isToday ? palette.paper : palette.muted,
                        fontSize: 11,
                        fontWeight: day.isToday ? "700" : "600",
                        fontFamily: "monospace",
                      }}
                    >
                      {day.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Legend */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: 4,
            }}
          >
            {/* Avg line key */}
            <View
              style={{
                width: "50%",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  width: 18,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <View
                    key={`avg-legend-${i}`}
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: 1.5,
                      backgroundColor: "rgba(250, 250, 250, 0.75)",
                    }}
                  />
                ))}
              </View>
              <Text
                style={{
                  color: palette.muted,
                  fontSize: 11,
                  fontFamily: "monospace",
                  fontWeight: "600",
                }}
              >
                Week avg {formatChartScale(avgPaise)}
              </Text>
            </View>

            {weekCategories.map((category) => (
              <View
                key={category}
                style={{
                  width: "50%",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 4,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 4,
                    backgroundColor: getCategoryChartColor(category),
                  }}
                />
                <Text
                  style={{
                    color: palette.muted,
                    fontSize: 11,
                    fontFamily: "monospace",
                    fontWeight: "600",
                  }}
                  numberOfLines={1}
                >
                  {category}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
