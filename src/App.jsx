import React, { useState, useEffect } from 'react';
import { calculateLoot, calculateMaxPotential, targetsData } from './utils/calculator';
import './index.css';

// format currency
const formatMoney = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
};

const formatActions = (name, presses) => {
  const target = targetsData.targets.secondary.find(t => t.name === name);
  if (!target) return `${presses} Click${presses !== 1 ? 's' : ''}`;

  const actionsPerStack = target.pickup_units.length;

  if (presses >= actionsPerStack) {
    const stacks = Math.floor(presses / actionsPerStack);
    const leftover = presses % actionsPerStack;

    if (leftover === 0) {
      return `${stacks} Stack${stacks > 1 ? 's' : ''}`;
    }
    return (
      <span className="flex flex-col items-start leading-none gap-1">
        <span className="font-semibold">{stacks} Stack{stacks > 1 ? 's' : ''}</span>
        <span className="opacity-75 text-[10px]">+ {leftover} Click{leftover !== 1 ? 's' : ''}</span>
      </span>
    );
  }

  return `${presses} Click${presses !== 1 ? 's' : ''}`;
};

function App() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('cayoSettings');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      players: 1,
      hardMode: true,
      withinCooldown: true,
      goldAlone: false,
      primaryTarget: 'tequila',
      tables: {
        gold: 0,
        cocaine: 0,
        weed: 0,
        paintings: 0,
        cash: 0,
      },
      cuts: {
        leader: 100,
        member1: 0,
        member2: 0,
        member3: 0
      }
    };
  });

  const [result, setResult] = useState(null);
  const [maxResult, setMaxResult] = useState(null);

  useEffect(() => {
    localStorage.setItem('cayoSettings', JSON.stringify(settings));
    const res = calculateLoot(settings);
    const maxRes = calculateMaxPotential(settings);
    setResult(res);
    setMaxResult(maxRes);
  }, [settings]);

  const updateSetting = (key, value) => {
    if (key === 'players') {
      setSettings(prev => {
        const oldPlayers = prev.players;
        const newPlayers = value;
        let newCuts = { ...prev.cuts };

        if (newPlayers > oldPlayers) {
          // Adding players
          for (let i = oldPlayers + 1; i <= newPlayers; i++) {
            const memberKey = `member${i - 1}`;
            newCuts[memberKey] = 15;

            // Try taking from leader
            if (newCuts.leader - 15 >= 15) {
              newCuts.leader -= 15;
            } else {
              // Leader can't afford it, reset to safe defaults
              // Everyone gets 15%, Leader gets remainder
              const totalMembers = newPlayers - 1;
              const membersCut = totalMembers * 15; // 15% each
              newCuts.leader = 100 - membersCut;
              for (let m = 1; m <= totalMembers; m++) {
                newCuts[`member${m}`] = 15;
              }
              break; // Stop processing loop since we reset everything
            }
          }
        } else if (newPlayers < oldPlayers) {
          // Removing players: Give cut back to Leader
          for (let i = oldPlayers; i > newPlayers; i--) {
            const memberKey = `member${i - 1}`;
            const amount = newCuts[memberKey];
            newCuts[memberKey] = 0;
            newCuts.leader += amount;
          }
        }
        return { ...prev, players: newPlayers, cuts: newCuts };
      });
    } else {
      setSettings(prev => ({ ...prev, [key]: value }));
    }
  };

  const updateTable = (type, value) => {
    setSettings(prev => ({
      ...prev,
      tables: { ...prev.tables, [type]: Math.max(0, value) }
    }));
  };

  const updateCut = (member, value) => {
    setSettings(prev => {
      if (member === 'leader') return prev; // Leader is calculated automatically

      // Enforce minimum 15% for the member being edited
      if (value < 15) return prev;

      const otherMembersCut = Object.keys(prev.cuts)
        .filter(k => k !== 'leader' && k !== member)
        .reduce((acc, k) => acc + prev.cuts[k], 0);

      const proposedLeaderCut = 100 - (value + otherMembersCut);

      // Enforce minimum 15% for the leader
      if (proposedLeaderCut < 15) return prev;

      return {
        ...prev,
        cuts: {
          ...prev.cuts,
          [member]: value,
          leader: proposedLeaderCut
        }
      };
    });
  }

  if (!result || !maxResult) return <div className="min-h-screen grid place-items-center"><span className="loading loading-spinner loading-lg"></span></div>;

  return (
    <div className="min-h-screen bg-base-300 p-4 md:p-8 font-sans transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="navbar bg-base-100 rounded-box shadow-lg mb-8">
          <div className="flex-1 justify-center items-center gap-2">
            <img src="/logo.png" className="w-16 h-16" />
            <span className="text-xl font-bold text-primary">Cayo Perico Loot Calculator</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-5 space-y-6">

            {/* Mission Settings */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-secondary">Mission Setup</h2>

                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text font-semibold">Number of Players</span>
                    <span className="badge badge-primary">{settings.players}</span>
                  </label>
                  <input
                    type="range" min="1" max="4" value={settings.players} className="range range-primary" step="1"
                    onChange={(e) => updateSetting('players', parseInt(e.target.value))}
                  />
                  <div className="w-full flex justify-between text-xs px-2 mt-2 font-mono">
                    <span>1</span><span>2</span><span>3</span><span>4</span>
                  </div>
                </div>

                <div className="form-control w-full mt-4">
                  <label className="label">
                    <span className="label-text font-semibold">Primary Target</span>
                  </label>
                  <select
                    className="select select-bordered w-full select-primary"
                    value={settings.primaryTarget}
                    onChange={(e) => updateSetting('primaryTarget', e.target.value)}
                  >
                    {targetsData.targets.primary.map(t => (
                      <option key={t.name} value={t.name}>
                        {t.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="divider my-2"></div>

                <div className="flex flex-col gap-3">
                  <div className="form-control bg-base-200 p-2 rounded-lg">
                    <label className="label cursor-pointer gap-2">
                      <span className="label-text font-medium">Hard Mode</span>
                      <input type="checkbox" className="toggle toggle-error" checked={settings.hardMode} onChange={(e) => updateSetting('hardMode', e.target.checked)} />
                    </label>
                  </div>
                  <div className="form-control bg-base-200 p-2 rounded-lg">
                    <label className="label cursor-pointer gap-2">
                      <span className="label-text font-medium">Within 72h Cooldown (Bonus)</span>
                      <input type="checkbox" className="toggle toggle-secondary" checked={settings.withinCooldown} onChange={(e) => updateSetting('withinCooldown', e.target.checked)} />
                    </label>
                  </div>
                  {settings.players === 1 && (
                    <div className="form-control bg-warning/10 p-2 rounded-lg border border-warning/20">
                      <label className="label cursor-pointer gap-2">
                        <span className="label-text  font-medium">Gold Glitch (Solo)</span>
                        <input type="checkbox" className="toggle toggle-warning" checked={settings.goldAlone} onChange={(e) => updateSetting('goldAlone', e.target.checked)} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Secondary Loot */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-accent">Available Loot Tables</h2>
                <div className="space-y-3">
                  {['gold', 'cocaine', 'weed', 'paintings', 'cash'].map(type => (
                    <div key={type} className="flex items-center justify-between p-2 hover:bg-base-200 rounded-lg transition-colors">
                      <span className="capitalize font-medium flex items-center gap-2">
                        {type}
                      </span>
                      <div className="join">
                        <button className="join-item btn btn-sm btn-square btn-outline" onClick={() => updateTable(type, settings.tables[type] - 1)}>-</button>
                        <input className="join-item input input-sm input-bordered w-12 text-center" value={settings.tables[type]} readOnly />
                        <button className="join-item btn btn-sm btn-square btn-outline" onClick={() => updateTable(type, settings.tables[type] + 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cuts */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-info">Crew Cuts</h2>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Leader</span>
                      <span className="badge badge-info">{settings.cuts.leader}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={settings.cuts.leader} readOnly className="range range-xs range-info cursor-not-allowed opacity-60" />
                  </div>
                  {Array.from({ length: settings.players - 1 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Player {i + 2}</span>
                        <span className="badge badge-ghost">{settings.cuts[`member${i + 1}`]}%</span>
                      </div>
                      <input type="range" min="0" max="100" step="5" value={settings.cuts[`member${i + 1}`]} onChange={(e) => updateCut(`member${i + 1}`, parseInt(e.target.value))} className="range range-xs range-ghost" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-6">

            {/* Big Total */}
            <div className="stats shadow-lg w-full bg-gradient-to-r from-neutral to-neutral-focus text-neutral-content">
              <div className="stat">
                <div className="stat-title text-neutral-content opacity-80">Estimated Final Payout</div>
                <div className="stat-value text-success text-5xl md:text-6xl tracking-tight">{formatMoney(result.finalPayout)}</div>
                <div className="stat-desc text-neutral-content opacity-70 mt-1">Net profit after fencing & Pavel's cut</div>
              </div>
            </div>

            {/* SCENARIO COMPARISON CARD */}
            <div className="card bg-base-100 shadow-xl border-t-4 border-secondary">
              <div className="card-body">
                <h3 className="card-title text-secondary mb-4">Leader's Optimization Strategy</h3>
                <p className="text-sm opacity-70 mb-4">
                  Which crew size pays <strong>YOU</strong> the most? Assuming you take maximum possible cut (paying others 15%).
                  <br />
                  <span className="text-xs text-warning">* Solo scenario excludes Gold unless glitch is enabled.</span>
                </p>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(pCount => {
                    // Calculate scenario
                    const scenarioSettings = {
                      ...settings,
                      players: pCount,
                    };
                    const scenarioRes = calculateLoot(scenarioSettings);

                    // Max Leader Cut Logic
                    // 1 Player: 100%
                    // 2 Players: 85% (100 - 15)
                    // 3 Players: 70% (100 - 15 - 15)
                    // 4 Players: 55% (100 - 15 - 15 - 15)
                    const maxLeaderCut = 100 - ((pCount - 1) * 15);
                    const leaderTake = scenarioRes.finalPayout * (maxLeaderCut / 100);

                    const isCurrent = settings.players === pCount;
                    const isBest = [1, 2, 3, 4].map(p => {
                      const res = calculateLoot({ ...settings, players: p });
                      const cut = 100 - ((p - 1) * 15);
                      return res.finalPayout * (cut / 100);
                    }).every(val => val <= leaderTake);

                    return (
                      <div key={pCount} className={`flex flex-col relative overflow-hidden rounded-2xl border transition-all duration-300 ${isCurrent ? (isBest ? 'border-success shadow-xl scale-105 z-20 bg-base-100' : 'border-error shadow-xl scale-105 z-20 bg-base-100') : isBest ? 'border-success shadow-lg scale-100 z-10 bg-base-100 ring-1 ring-success' : 'border-base-300 bg-base-200/50 opacity-80'}`}>
                        {isCurrent && (
                          <div className={`${isBest ? 'bg-success text-success-content' : 'bg-error text-error-content'} text-center text-[10px] font-bold tracking-widest uppercase`}>
                            Current
                          </div>
                        )}
                        <div className={`p-2 flex flex-col h-full justify-between ${isCurrent ? '' : isBest ? 'pt-2' : 'pt-5'}`}>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-xs font-bold uppercase opacity-60 tracking-wider">
                                {pCount === 1 ? 'Solo' : `${pCount} Players`}
                              </div>
                              {isBest && <div className="text-[10px] font-bold text-success bg-success/10 px-2 py-1 rounded-md">BEST</div>}
                            </div>

                            <div className={`text-xl font-black tracking-tight ${isBest ? 'text-success' : 'text-base-content'}`}>
                              {formatMoney(leaderTake)}
                            </div>
                          </div>

                          <div className="flex justify-between items-end mt-4 pt-4 border-t border-base-content/5 text-xs opacity-50 font-mono">
                            <span>Cut {maxLeaderCut}%</span>
                            <span>Total {formatMoney(scenarioRes.finalPayout)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Breakdown */}
              <div className="card bg-base-100 shadow-xl border-t-4 border-primary">
                <div className="card-body p-6">
                  <h3 className="card-title text-lg mb-4">Financial Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <tbody>
                        <tr className="hover">
                          <td>Primary Target</td>
                          <td className="text-right font-mono">{formatMoney(result.primaryValue)}</td>
                        </tr>
                        <tr className="hover">
                          <td>Secondary Loot</td>
                          <td className="text-right font-mono">{formatMoney(result.totalSecondaryValue)}</td>
                        </tr>
                        <tr className="hover">
                          <td>Office Safe (Avg)</td>
                          <td className="text-right font-mono">{formatMoney(result.officeSafe)}</td>
                        </tr>
                        <tr className="bg-base-200 font-bold">
                          <td>Gross Total</td>
                          <td className="text-right font-mono">{formatMoney(result.totalLootValue + result.officeSafe)}</td>
                        </tr>
                        <tr className="text-error text-sm">
                          <td>Fencing Fee (10%)</td>
                          <td className="text-right font-mono">-{formatMoney(result.fees.fencing)}</td>
                        </tr>
                        <tr className="text-error text-sm">
                          <td>Pavel's Cut (2%)</td>
                          <td className="text-right font-mono">-{formatMoney(result.fees.pavel)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="card bg-base-100 shadow-xl border-t-4 border-warning">
                <div className="card-body p-6">
                  <h3 className="card-title text-lg mb-4">Performance</h3>
                  <div className="stat p-4 bg-base-200 rounded-xl mb-4">
                    <div className="stat-title text-xs uppercase tracking-wide opacity-60">Elite Challenge</div>
                    <div className="stat-value text-xl text-warning">{formatMoney(result.eliteChallenge)}</div>
                    <div className="stat-desc text-xs mt-1">Add this if completed under time limit</div>
                  </div>

                  <div className="stat p-4 bg-base-200 rounded-xl">
                    <div className="stat-title text-xs uppercase tracking-wide opacity-60">Bag Efficiency</div>
                    <div className="stat-value text-xl">
                      {((result.totalCapacity - result.remainingCapacity) / result.totalCapacity * 100).toFixed(1)}%
                    </div>
                    <progress className="progress progress-success w-full mt-2" value={result.totalCapacity - result.remainingCapacity} max={result.totalCapacity}></progress>
                    <div className="stat-desc text-xs mt-1">Capacity Used</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bag Contents */}
            {result.results.length > 0 && (
              <div className="card bg-base-100 shadow-xl border-t-4 border-info">
                <div className="card-body p-6">
                  <h3 className="card-title text-lg mb-4">Optimal Loot Strategy</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {result.results.map((item, idx) => (
                      <div key={idx} className="stats shadow bg-base-200 hover:scale-105 transition-transform">
                        <div className="stat p-4">
                          <div className="stat-title capitalize font-bold text-base-content">{item.name}</div>
                          <div className="stat-value text-lg text-primary">{item.bags.toFixed(2)} Bags</div>
                          <div className="stat-desc mt-1 flex justify-between items-center">
                            <span>{formatActions(item.name, item.presses)}</span>
                            <span className="font-bold text-success-content badge badge-success text-xs py-2">{formatMoney(item.value)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Player Breakdown */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg mb-4">Crew Shares</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card bg-base-200 compact">
                    <div className="card-body p-4 text-center">
                      <div className="text-xs uppercase tracking-wide opacity-60">Leader</div>
                      <div className="font-extrabold text-lg text-primary">{formatMoney(result.finalPayout * settings.cuts.leader / 100)}</div>
                    </div>
                  </div>
                  {Array.from({ length: settings.players - 1 }).map((_, i) => (
                    <div key={i} className="card bg-base-200 compact">
                      <div className="card-body p-4 text-center">
                        <div className="text-xs uppercase tracking-wide opacity-60">Player {i + 2}</div>
                        <div className="font-extrabold text-lg text-secondary">{formatMoney(result.finalPayout * settings.cuts[`member${i + 1}`] / 100)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Loot Reference Table */}
        <div className="card bg-base-100 shadow-xl mt-8">
          <div className="card-body">
            <h3 className="card-title text-secondary mb-4">Secondary Loot Values</h3>
            <div className="overflow-x-auto">
              <table className="table table-xs md:table-sm w-full">
                <thead>
                  <tr className="text-base-content/70 border-b-2 border-base-200">
                    <th className="font-bold">Target</th>
                    <th className="font-bold text-right">Stack</th>
                    <th className="font-bold text-right">Full Bag</th>
                    <th className="font-bold text-right">Fill %</th>
                  </tr>
                </thead>
                <tbody>
                  {targetsData.targets.secondary.map(target => {
                    // Calculate multiplier based on selected primary target and cooldown setting
                    const primaryTargetData = targetsData.targets.primary.find(t => t.name === settings.primaryTarget);
                    const multiplier = settings.withinCooldown && primaryTargetData ? primaryTargetData.bonus_multiplier : 1;

                    const avgValueRaw = (target.value.min + target.value.max) / 2;
                    const avgValue = avgValueRaw * multiplier;
                    const fillPercent = (target.full_table_units / targetsData.bag_capacity) * 100;
                    const fullBagValue = (avgValue / target.full_table_units) * targetsData.bag_capacity;

                    return (
                      <tr key={target.name} className="hover">
                        <td className="capitalize font-bold">{target.name}</td>
                        <td className="text-right font-mono">{formatMoney(avgValue)}</td>
                        <td className="text-right font-mono">{formatMoney(fullBagValue)}</td>
                        <td className="text-right font-mono">{fillPercent.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <footer className="footer footer-center p-4 bg-base-300 text-base-content rounded-box mt-12">
          <div className="flex flex-col gap-1">
            <p className="text-sm">Designed by <a href="https://github.com/AvinashPatel005" target="_blank" rel="noopener noreferrer" className="link link-hover font-bold text-primary">@AvinashPatel005</a></p>
            <p className="text-xs opacity-70">Thanks to <a href="https://github.com/MichalD96" target="_blank" rel="noopener noreferrer" className="link link-hover font-bold text-secondary">@MichalD96</a></p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
