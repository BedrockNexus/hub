import type {
	AdapterConfidence,
	AdapterDetection,
	AdapterResolution,
	DetectionSignal,
} from './types'

export const CONFIDENT_ADAPTER_SCORE = 65
export const AMBIGUITY_SCORE_MARGIN = 15

export function confidenceForScore(score: number): AdapterConfidence {
	if (score >= 80) {
		return 'high'
	}
	if (score >= CONFIDENT_ADAPTER_SCORE) {
		return 'medium'
	}
	if (score > 0) {
		return 'low'
	}
	return 'none'
}

export function detectionFromSignals(
	adapterId: AdapterDetection['adapterId'],
	adapterName: string,
	signals: readonly DetectionSignal[],
): AdapterDetection {
	const score = Math.min(
		100,
		signals.reduce(
			(total, signal) => total + (signal.matched ? signal.weight : 0),
			0,
		),
	)
	const matched = signals.filter((signal) => signal.matched)

	return {
		adapterId,
		adapterName,
		score,
		confidence: confidenceForScore(score),
		signals,
		summary:
			matched.length === 0
				? `No ${adapterName} project signals were found.`
				: `${matched.length} ${adapterName} signal${matched.length === 1 ? '' : 's'} matched: ${matched
						.map((signal) => signal.label)
						.join(', ')}.`,
	}
}

export function resolveAdapterDetections(
	detections: readonly AdapterDetection[],
): AdapterResolution {
	const candidates = [...detections].sort(
		(left, right) =>
			right.score - left.score ||
			left.adapterId.localeCompare(right.adapterId),
	)
	const first = candidates[0]
	const second = candidates[1]

	if (!first || first.score < CONFIDENT_ADAPTER_SCORE) {
		return {
			kind: 'unsupported',
			candidates,
			explanation: `No enabled adapter reached the ${CONFIDENT_ADAPTER_SCORE}-point compatibility threshold.`,
		}
	}

	if (
		second &&
		second.score >= CONFIDENT_ADAPTER_SCORE &&
		first.score - second.score < AMBIGUITY_SCORE_MARGIN
	) {
		return {
			kind: 'ambiguous',
			candidates,
			explanation: `${first.adapterName} and ${second.adapterName} are within ${AMBIGUITY_SCORE_MARGIN} points. The developer must choose an adapter.`,
		}
	}

	return {
		kind: 'matched',
		selected: first,
		candidates,
		explanation: `${first.adapterName} is the strongest compatible adapter at ${first.score}/100 confidence points.`,
	}
}
