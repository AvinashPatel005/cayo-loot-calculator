
import data from '../data.json';

const BAG_CAPACITY = data.bag_capacity || 1800;
const VALUE_PRIORITY = ['gold', 'cocaine', 'weed', 'paintings', 'cash'];

export const targetsData = data;

function getAverage(min, max) {
    return (min + max) / 2;
}

function getTargetData(targetType) {
    const target = data.targets.secondary.find((t) => t.name === targetType);
    return {
        pickupUnits: target.pickup_units,
        fullTableUnits: target.full_table_units,
        minValue: target.value.min,
        maxValue: target.value.max,
    };
}

function calculateLootForTarget(targetType, availableTables, remainingCapacity, allowOverfill = false) {
    if (remainingCapacity <= 0 || availableTables <= 0) {
        return { units: 0, presses: 0, tablesUsed: 0 };
    }

    const { pickupUnits, fullTableUnits } = getTargetData(targetType);

    let totalUnits = 0;
    let totalPresses = 0;
    let tablesUsed = 0;
    let capacityLeft = remainingCapacity;

    for (let t = 0; t < availableTables && capacityLeft > 0; t++) {
        if (targetType === 'paintings') {
            if (capacityLeft >= fullTableUnits) {
                totalUnits += fullTableUnits;
                totalPresses += 1;
                tablesUsed++;
                capacityLeft -= fullTableUnits;
            } else if (allowOverfill && capacityLeft > 0) {
                totalUnits += capacityLeft;
                totalPresses += 1;
                tablesUsed++;
                capacityLeft = 0;
            } else {
                break;
            }
        } else {
            let unitsFromThisTable = 0;
            let pressesForThisTable = 0;
            let lastPressOverfill = 0;

            for (let p = 0; p < pickupUnits.length; p++) {
                const cumulativeUnits = pickupUnits[p];
                if (cumulativeUnits <= capacityLeft) {
                    unitsFromThisTable = cumulativeUnits;
                    pressesForThisTable = p + 1;
                } else {
                    if (allowOverfill && p === pressesForThisTable) {
                        lastPressOverfill = cumulativeUnits;
                    }
                    break;
                }
            }

            if (unitsFromThisTable > 0) {
                totalUnits += unitsFromThisTable;
                totalPresses += pressesForThisTable;
                tablesUsed++;
                capacityLeft -= unitsFromThisTable;
            }

            // If we have capacity left, allow overfill means we can take partial from the last step if needed?
            // Original logic: if (capacityLeft > 0 && allowOverfill && lastPressOverfill > 0)
            if (capacityLeft > 0 && allowOverfill && lastPressOverfill > 0) {
                totalUnits += capacityLeft;
                totalPresses += 1;
                capacityLeft = 0;
            } else if (unitsFromThisTable === 0) {
                if (allowOverfill && capacityLeft > 0 && capacityLeft < pickupUnits[0]) {
                    totalUnits += capacityLeft;
                    totalPresses += 1;
                    capacityLeft = 0;
                }
                break;
            }
        }
    }

    return { units: totalUnits, presses: totalPresses, tablesUsed };
}

export function calculateLoot(settings) {
    // settings: { players, hardMode, withinCooldown, goldAlone, primaryTarget, tables: { gold, cocaine... } }
    const players = settings.players;
    const totalCapacity = players * BAG_CAPACITY;
    let remainingCapacity = totalCapacity;

    const isHardMode = settings.hardMode ? 'hard' : 'standard';
    const primaryTargetData = data.targets.primary.find(({ name }) => name === settings.primaryTarget);
    // fallback if not found?
    if (!primaryTargetData) return null;

    const withinCooldownBonus = settings.withinCooldown ? primaryTargetData.bonus_multiplier : 1;

    const results = [];
    let totalSecondaryValue = 0;

    for (const targetType of VALUE_PRIORITY) {
        if (remainingCapacity <= 0) break;
        if (targetType === 'cash') continue;

        const availableTables = settings.tables[targetType] || 0;
        if (availableTables <= 0) continue;

        if (targetType === 'gold' && players === 1 && !settings.goldAlone) continue;

        const targetData = getTargetData(targetType);
        if (targetType === 'paintings' && remainingCapacity < targetData.fullTableUnits) continue;

        const allowOverfill = targetType !== 'paintings';
        const lootResult = calculateLootForTarget(targetType, availableTables, remainingCapacity, allowOverfill);

        if (lootResult.units > 0) {
            const bagsFilled = lootResult.units / BAG_CAPACITY;
            const avgValue = getAverage(targetData.minValue, targetData.maxValue);
            const valueCollected = lootResult.units / targetData.fullTableUnits * avgValue * withinCooldownBonus;

            results.push({
                name: targetType,
                units: lootResult.units,
                bags: bagsFilled,
                presses: lootResult.presses,
                value: valueCollected,
            });

            totalSecondaryValue += valueCollected;
            remainingCapacity -= lootResult.units;
        }
    }

    if (remainingCapacity > 0) {
        const cashAvailable = settings.tables['cash'] || 0;
        if (cashAvailable > 0) {
            const targetData = getTargetData('cash');
            const lootResult = calculateLootForTarget('cash', cashAvailable, remainingCapacity, true);

            if (lootResult.units > 0) {
                const bagsFilled = lootResult.units / BAG_CAPACITY;
                const avgValue = getAverage(targetData.minValue, targetData.maxValue);
                const valueCollected = lootResult.units / targetData.fullTableUnits * avgValue * withinCooldownBonus;

                results.push({
                    name: 'cash',
                    units: lootResult.units,
                    bags: bagsFilled,
                    presses: lootResult.presses,
                    value: valueCollected,
                });

                totalSecondaryValue += valueCollected;
                remainingCapacity -= lootResult.units;
            }
        }
    }

    const primaryValue = primaryTargetData.value[isHardMode];
    const totalLootValue = (totalSecondaryValue + primaryValue) * data.events_multiplier;
    const officeSafe = data.targets.office_safe;
    const averageOfficeSafe = getAverage(officeSafe.min, officeSafe.max);

    // Fees
    const fencingFee = totalLootValue * 0.1;
    const pavelFee = totalLootValue * 0.02;
    const eliteChallenge = data.elite_challenge[isHardMode];

    const finalPayout = totalLootValue + averageOfficeSafe - fencingFee - pavelFee;

    return {
        results,
        totalLootValue,
        finalPayout,
        fees: { fencing: fencingFee, pavel: pavelFee },
        officeSafe: averageOfficeSafe,
        eliteChallenge,
        primaryValue,
        totalSecondaryValue,
        remainingCapacity,
        totalCapacity
    };
}

export function calculateMaxPotential(settings) {
    // Determine infinite tables based on player count and hard mode
    // We just give enough of everything to fill capacity
    // The main calculator logic handles priority and exclusions (like Gold for solo)
    const infiniteTables = {
        gold: 10,     // More than enough for 4 players (4 * 1.5 stacks = 6 stacks?) Actually 4 players = 4 bags. Gold = 2/3 bag. 4 bags = 6 gold stacks. 
        cocaine: 10,
        weed: 10,
        paintings: 10,
        cash: 10
    };

    const perfectSettings = {
        ...settings,
        tables: infiniteTables
    };

    return calculateLoot(perfectSettings);
}
