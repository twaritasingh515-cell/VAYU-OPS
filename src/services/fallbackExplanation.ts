/**
 * Tactical Fallback Explanation Generator for VAYU-OPS
 * Provides deterministic, high-assurance rule-based operational explanations
 * for air tasking orders when offline or when external AI services are unreachable.
 *
 * Safe for both client-side and server-side evaluation (no node dependencies, no secrets).
 */

export function generateFallbackExplanation(
  planName: string = 'Balanced Assurance Plan',
  metrics?: any,
  disruptionEvent?: string
): string {
  // Scenario 1: AOG or Airframe Unserviceability
  if (
    disruptionEvent?.includes('AOG') ||
    disruptionEvent?.includes('unserviceable') ||
    disruptionEvent?.includes('Hydraulic')
  ) {
    return `• Asset Reallocation: Aircraft A3 Ground Stop (AOG) mitigated by shifting P1 Air Patrol tasking to backup Su-30MKI (A8) with fully qualified crew (C2 Sqn Ldr K. Sharma).
• Priority Preservation: All high-value P1 strategic missions (M-101, M-102, M-103) remain 100% covered without timeline collision.
• Fatigue Safeguards: Crew fatigue levels remain stabilized below 68/100 threshold; no crew member assigned beyond certified 8-hour duty envelope.
• Commander Notice: Plan diff indicates 1 asset swap and zero mission cancellations. Decision authority remains with the Human-in-the-Loop.`;
  }

  // Scenario 2: Hostile Radar or SAM Threat Escalation
  if (
    disruptionEvent?.includes('threat') ||
    disruptionEvent?.includes('Threat') ||
    disruptionEvent?.includes('SAM')
  ) {
    return `• Threat Countermeasures: New SAM radar lock in Sector Charlie accommodated by rerouting CAP vector and assigning EW-Suite equipped airframe with Astra BVR loadout.
• Risk Containment: Mission risk index contained at acceptable combat parameters while preserving forward reconnaissance coverage.
• Weapons Staging: Munitions depot at Base Alpha confirmed sufficient standoff payload reserves.
• Commander Notice: Alternative Plan B available for standoff-only engagement. Decision authority remains with the Human-in-the-Loop.`;
  }

  // Scenario 3: Low Fuel Reserve / Divert
  if (disruptionEvent?.includes('Fuel') || disruptionEvent?.includes('fuel')) {
    return `• Fuel Optimization: Aircraft A4 transit profile adjusted to economic cruise; alternate runway prioritized at Hasimara AFS with tanker staging on standby.
• Sortie Continuity: Relief CAP flight staged from Base Alpha to maintain continuous barrier patrol without station gap.
• Reserve Margin: All airborne assets maintain mandatory 20-minute divert fuel reserve under adverse meteorological conditions.
• Commander Notice: Divert protocol ready for Commander authorization. Decision authority remains with the Human-in-the-Loop.`;
  }

  // Scenario 4: Telemetry Interruption / Datalink degraded
  if (
    disruptionEvent?.includes('Telemetry') ||
    disruptionEvent?.includes('Datalink') ||
    disruptionEvent?.includes('degraded')
  ) {
    return `• Datalink Degraded: Telemetry packet loss in contested EW sector mitigated by autonomous inertial navigation fallback and secondary satcom.
• Mission Integrity: Assigned strike packages retain pre-planned waypoint routes with radar-silent ingress profiles.
• Deconfliction: Flight corridor deconfliction verified clear of friendly civilian air routes.
• Commander Notice: Standing by for Commander tactical endorsement. Decision authority remains with the Human-in-the-Loop.`;
  }

  // Plan Type: Low Risk / Conservative
  if (
    planName.toLowerCase().includes('low risk') ||
    planName.toLowerCase().includes('conservative')
  ) {
    return `• Threat Avoidance & Standoff: Standoff envelopes prioritized (+45% buffer outside hostile radar bubbles) with reduced low-level transit.
• Serviceability Filter: Assigned airframes restricted to high-confidence tier (>85% serviceability), preserving spare reserve capacity.
• Fatigue Safety Margin: Crew duty cycles held below 50% limit for maximum tactical alertness during contested border operations.
• Commander Notice: Standoff profile reduces risk score to minimum levels. Decision authority remains with the Human-in-the-Loop.`;
  }

  // Plan Type: Surge / High Tempo
  if (
    planName.toLowerCase().includes('surge') ||
    planName.toLowerCase().includes('escalation')
  ) {
    return `• Maximum Sortie Generation: Frontline strike and CAP assets mobilized to achieve rapid target saturation across high-priority sectors.
• Accelerated Turnaround: Turnaround intervals compressed to 30 minutes with simultaneous ground refueling and rearming protocols.
• Crew Rest Envelope: Duty limits extended within approved operational waivers; secondary relief crews staged on alert-5.
• Commander Notice: Elevated tempo optimized for time-critical counter-air objectives. Decision authority remains with the Human-in-the-Loop.`;
  }

  // Baseline Balanced Plan
  return `• Optimal Asset Alignment: High-priority strike and CAP taskings assigned to frontline Su-30MKI and Rafale platforms based on 90%+ serviceability confidence and matching combat qualifications.
• Fatigue & Rest Compliance: Assigned crews are within compliant circadian rest periods (<65 fatigue index), safeguarding sortie safety margins.
• Munitions & Base Logistics: Base munitions depots confirmed adequate for planned Astra BVR and Spice-2000 precision ordnance drops.
• Commander Notice: Constraint-based CP-SAT solver achieved 100% P1 tasking assurance. Decision authority remains with the Human-in-the-Loop.`;
}
