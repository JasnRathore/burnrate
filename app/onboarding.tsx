import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgUri } from 'react-native-svg';
import { BlurView } from 'expo-blur';

import { Field, palette } from '@/components/burnrate/ui';
import { formatInr, parseRupeesToPaise } from '@/features/burnrate/calculations';
import { useBurnrateStore } from '@/features/burnrate/store';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type StepId = 'welcome' | 'local' | 'balance' | 'sms' | 'ready';

const STEPS: StepId[] = ['welcome', 'local', 'balance', 'sms', 'ready'];

// Accent tint per step — drives the headline accent and ring icon.
const STEP_TINT: Record<StepId, string> = {
  welcome: '#3B82F6',
  local: '#60A5FA',
  balance: '#FBBF24',
  sms: '#38BDF8',
  ready: '#4ADE80',
};

// Per-step background pattern config for the jasn-patterns generator — each
// step gets its own seed and two-tone palette so the texture changes as the
// person moves through onboarding, while staying dark enough for legibility.
const PATTERN_BASE = 'https://jasn-patterns.vercel.app/api/svg';

type PatternConfig = { seed: number; rows: number; bg: string; colorA: string; colorB: string };

const STEP_PATTERN: Record<StepId, PatternConfig> = {
  welcome: { seed: 54075, rows: 4, bg: '#00000000', colorA: '#12294f', colorB: '#3B82F6' },
  local: { seed: 7913,rows: 4,  bg: '#00000000', colorA: '#173154', colorB: '#60A5FA' },
//balance: { seed: 3,rows: 2,  bg: '#00000000', colorA: '#4a3208', colorB: '#FBBF24' },
  balance: { seed: 25352,rows: 2,  bg: '#00000000', colorA: '#4a3208', colorB: '#FBBF24' },
  sms: { seed: 42324,rows: 2,  bg: '#00000000', colorA: '#0d3a47', colorB: '#38BDF8' },
  ready: { seed: 5,rows: 3,  bg: '#00000000', colorA: '#123a24', colorB: '#4ADE80' },
};

function patternUrl(cfg: PatternConfig) {
  const params = new URLSearchParams({
    cols: '2',
    rows: cfg.rows.toString(),
    gap: '0',
    padding: '50',
    template: '70',
    wide: '35',
    radius: '0',
    seed: String(cfg.seed),
    bg: cfg.bg,
    colorA: cfg.colorA,
    colorB: cfg.colorB,
    shapes: 'square,circle,quarter,half,pill',
  });
  return `${PATTERN_BASE}?${params.toString()}`;
}

export default function OnboardingScreen() {
  const completeOnboarding = useBurnrateStore((s) => s.completeOnboarding);
  const insets = useSafeAreaInsets();

  const [stepIndex, setStepIndex] = useState(0);
  const [balance, setBalance] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[stepIndex]!;
  const balancePaise = useMemo(() => parseRupeesToPaise(balance), [balance]);
  const canContinueBalance =
    balance.trim() !== '' && balancePaise !== null && balancePaise >= 0;
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepIndex > 0) {
        setStepIndex((i) => Math.max(0, i - 1));
      }
      return true;
    });
    return () => sub.remove();
  }, [stepIndex]);

  function goNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    if (step === 'balance' && !canContinueBalance) {
      setError('Enter your available balance (0 is fine).');
      return;
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  function goBack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function finish() {
    if (balancePaise === null) {
      setError('Enter a valid balance first.');
      setStepIndex(STEPS.indexOf('balance'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding({
        openingBalancePaise: balancePaise,
        smsConsentGranted: smsConsent,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish setup.');
    } finally {
      setSaving(false);
    }
  }

  const copy = STEP_COPY[step];
  const tint = STEP_TINT[step];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PatternBackground step={step} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top progress segments — full width, story-style */}
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  i < stepIndex && styles.progressFillDone,
                  i === stepIndex && [
                    styles.progressFillActive,
                    { backgroundColor: tint },
                  ],
                ]}
              />
            </View>
          ))}
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Headline — Revolut-style stacked bold type
          <View style={styles.headlineBlock}>
            {copy.lines.map((line, i) => (
              <Text key={i} style={styles.headline}>
                {line.parts.map((part, j) => (
                  <Text
                    key={j}
                    style={part.accent ? [styles.headlineAccent, { color: tint }] : undefined}
                  >
                    {part.text}
                    {j < line.parts.length - 1 ? ' ' : ''}
                  </Text>
                ))}
              </Text>
            ))}

            {copy.sub ? <Text style={styles.subhead}>{copy.sub}</Text> : null}
          </View>
*/}
          <View style={styles.headlineBlock}>
            {copy.lines.map((line, i) => (
              <Text key={i} style={styles.headline}>
                {line.parts.map((part, j) => (
                  <Text
                    key={j}
                    style={part.accent ? [styles.headlineAccent, { color: tint }] : undefined}
                  >
                    {part.text}
                    {j < line.parts.length - 1 ? ' ' : ''}
                  </Text>
                ))}
              </Text>
            ))}
            {copy.sub ? <Text style={styles.subhead}>{copy.sub}</Text> : null}
          </View>
          {/* Interactive body for form steps */}
          {step === 'balance' && (
            <View style={styles.formCard}>
              <BlurView style={styles.formBlur} intensity={100} tint="dark">
              <Field
                keyboardType="decimal-pad"
                placeholder="₹15,000"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={balance}
                onChangeText={(t) => {
                  setBalance(t);
                  setError(null);
                }}
                style={styles.formField}
                autoFocus
              />

              {canContinueBalance ? (
              ""
              ) : (
                <Text style={styles.formHint}>
                  Enter your current balance or enter 0 for Now.
                </Text>
                )}
                </BlurView>
            </View>
          )}

          {step === 'sms' && (
            <View style={styles.formCard}>
              <BlurView style={styles.formBlur} intensity={100} tint="dark">
              <View style={styles.consentRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.consentTitle}>I understand & consent</Text>
                  <Text style={styles.consentBody}>
                    On-device only. Monitoring stays off until Settings.
                  </Text>
                </View>
                <Switch
                  value={smsConsent}
                  onValueChange={(v) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSmsConsent(v);
                  }}
                  trackColor={{
                    false: 'rgba(255,255,255,0.14)',
                    true: '#3B82F6',
                  }}
                  thumbColor={palette.paper}
                />
                </View>
              </BlurView>
            </View>
          )}

          {step === 'ready' && (
            <View style={styles.summaryCard}>
              <BlurView style={styles.summaryCard2} intensity={100} tint="dark">
              <SummaryLine
                label="Opening balance"
                value={balancePaise != null ? formatInr(balancePaise) : '—'}
              />
              <View style={styles.summaryDivider} />
              <SummaryLine
                label="SMS consent"
                value={smsConsent ? 'Granted' : 'Not now'}
                />
              </BlurView>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        {/* Bottom CTAs */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.ctaRow}>
            {stepIndex > 0 ? (
              <Pressable
                onPress={goBack}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.btnSecondaryText}>Back</Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <Pressable
              onPress={isLast ? finish : goNext}
              disabled={saving || (step === 'balance' && !canContinueBalance)}
              style={({ pressed }) => [
                styles.btnPrimary,
                (saving || (step === 'balance' && !canContinueBalance)) &&
                  styles.btnDisabled,
                pressed && !saving && styles.btnPressed,
              ]}
            >
              <Text style={styles.btnPrimaryText}>
                {saving ? 'Saving…' : isLast ? 'Get started' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Copy ────────────────────────────────────────────────────────────────────

type HeadlineLine = { parts: { text: string; accent?: boolean }[] };

const STEP_COPY: Record<
  StepId,
  { lines: HeadlineLine[]; sub?: string }
> = {
  welcome: {
    lines: [
      { parts: [{ text: 'READY TO CHANGE' }] },
      { parts: [{ text: 'THE WAY YOU' }] },
      { parts: [{ text: 'SEE', accent: true }, { text: 'MONEY?' }] },
    ],
  },
  local: {
    lines: [
      { parts: [{ text: 'YOUR DATA,' }] },
      { parts: [{ text: 'STORED', accent: true }, { text: 'Locally.' }] },
    ],
  },
  balance: {
    lines: [
      { parts: [{ text: 'SET YOUR' }, { text: 'BASELINE', accent: true }] },
      { parts: [{ text: 'BALANCE.' }] },
    ],
  },
  sms: {
    lines: [
      { parts: [{ text: 'OPTIONAL' }] },
      { parts: [{ text: 'SMS', accent: true }, { text: 'IMPORT.' }] },
    ],
    sub: 'Bank & UPI alerts can create transactions automatically on Android.',
  },
  ready: {
    lines: [
      { parts: [{ text: 'YOU ARE' },{ text: 'READY', accent: true }] },
      { parts: [{ text: 'TO START.' }] },
    ],
    sub: 'Empty ledger. Your first entry is one tap away.',
  },
};

function PatternBackground({ step }: { step: StepId }) {
  const cfg = STEP_PATTERN[step];
  const uri = useMemo(() => patternUrl(cfg), [cfg]);

  return (
    <View style={styles.ambientRoot} pointerEvents="none">
      <SvgUri key={uri} uri={uri} width="100%" height="100%" style={styles.patternSvg} />
    </View>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  ambientRoot: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternSvg: {
    ...StyleSheet.absoluteFillObject,
    transform: [
      {
        translateY: SCREEN_H * 0.1, // tweak until the pattern sits where you want
      },
    ],
  },

  // Top progress segments
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  progressFillDone: {
    backgroundColor: '#FFFFFF',
  },
  progressFillActive: {
    backgroundColor: '#FFFFFF',
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 6,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  headlineBlock: {
    marginTop: 18,
    gap: 2,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 38,
    textTransform: 'uppercase',
  },
  headlineAccent: {
    color: '#60A5FA',
  },
  subhead: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    maxWidth: 320,
  },
  artStage: {
    height: Math.min(SCREEN_H * 0.34, 280),
    marginTop: 8,
    marginBottom: 8,
  },
  burst: {
    flex: 1,
    position: 'relative',
  },
  rayA: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    width: '80%',
    height: 1,
    transform: [{ rotate: '-18deg' }],
  },
  rayB: {
    position: 'absolute',
    top: '45%',
    left: '5%',
    width: '90%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ rotate: '12deg' }],
  },
  rayC: {
    position: 'absolute',
    top: '60%',
    left: '15%',
    width: '70%',
    height: 1,
    transform: [{ rotate: '-6deg' }],
  },
  floatIcon: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(20, 20, 22, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  floatRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(18, 18, 20, 0.95)',
  },
  formCard: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: "hidden",
    gap: 16,
  },
  formBlur: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 16,
  },

  formLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  formField: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 4,
    fontSize: 34,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -1,
  },

  formPreview: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },

  formHint: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 13,
    lineHeight: 18,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  consentTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  consentBody: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 18,
  },
  summaryCard: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 12,
    overflow: "hidden",
  },
  summaryCard2: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 18,
    gap: 12,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    marginTop: 10,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  btnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
