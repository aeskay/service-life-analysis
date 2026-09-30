import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadPMISDetailMap } from '../../utils/fileLoader';
import { loadState } from '../../utils/stateStore';
import { buildEvalData, buildDistressData } from '../../hooks/useVerifyCharts';

export default function BeforeTerminalWorkspace({ mode }) {
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const pmisDetailMap = await loadPMISDetailMap();
        const state = await loadState();
        
        const d_recon = state['reconstructed'];
        const d_in_service = state['inservice'];
        
        const getVerifiedRows = (d) => {
          if (!d) return [];
          const verifiedSet = new Set(d?.verifiedSNs || []);
          return (d?.pmisRows || []).filter(r => verifiedSet.has(r['ID'] || r['S/N']));
        };

        const verifiedRowsRecon = getVerifiedRows(d_recon);
        const verifiedRowsInService = getVerifiedRows(d_in_service);
        const verifiedRowsAll = [...verifiedRowsRecon, ...verifiedRowsInService];

        const actualEndOfLifeMapRecon = d_recon?.actualEndOfLifeMap || {};
        const actualYearConstMapRecon = d_recon?.actualYearConstMap || {};
        
        const actualYearConstMapAll = {
          ...(d_recon?.actualYearConstMap || {}),
          ...(d_in_service?.actualYearConstMap || {})
        };

        if (verifiedRowsRecon.length === 0 && verifiedRowsAll.length === 0) {
          if (active) setChartData({ empty: true });
          setLoading(false);
          return;
        }

        let maxYears = 0;
        let maxYearsForward = 0;
        let maxYearsForwardAll = 0;
        let maxYearsForwardInService = 0;
        
        for (const row of verifiedRowsRecon) {
          const uniqueId = row['ID'] || row['S/N'];
          const actualEOL = actualEndOfLifeMapRecon[uniqueId];
          const eolToUse = actualEOL || row['End of Life'];
          const terminalYear = parseInt(eolToUse, 10);
          
          let constructionYear = Number(row['Year Constructed']);
          if (actualYearConstMapRecon[uniqueId]) constructionYear = Number(actualYearConstMapRecon[uniqueId]);

          const evalData = buildEvalData(pmisDetailMap, row);
          if (!evalData || !evalData.years || evalData.years.length === 0) continue;
          
          if (!isNaN(terminalYear)) {
            const minYear = Math.min(...evalData.years);
            const offset = terminalYear - minYear;
            if (offset > maxYears) {
               maxYears = offset;
            }
          }

          if (!isNaN(constructionYear) && constructionYear > 0) {
            const maxYear = Math.max(...evalData.years);
            const offsetForward = maxYear - constructionYear;
            if (offsetForward > maxYearsForward) {
               maxYearsForward = offsetForward;
            }
          }
        }

        const actualYearConstMapInService = d_in_service?.actualYearConstMap || {};
        for (const row of verifiedRowsInService) {
          const uniqueId = row['ID'] || row['S/N'];
          let constructionYear = Number(row['Year Constructed']);
          if (actualYearConstMapInService[uniqueId]) constructionYear = Number(actualYearConstMapInService[uniqueId]);

          const evalData = buildEvalData(pmisDetailMap, row);
          if (!evalData || !evalData.years || evalData.years.length === 0) continue;
          
          if (!isNaN(constructionYear) && constructionYear > 0) {
            const maxYear = Math.max(...evalData.years);
            const offsetForward = maxYear - constructionYear;
            if (offsetForward > maxYearsForwardInService) {
               maxYearsForwardInService = offsetForward;
            }
          }
        }

        for (const row of verifiedRowsAll) {
          const uniqueId = row['ID'] || row['S/N'];
          let constructionYear = Number(row['Year Constructed']);
          if (actualYearConstMapAll[uniqueId]) constructionYear = Number(actualYearConstMapAll[uniqueId]);

          const evalData = buildEvalData(pmisDetailMap, row);
          if (!evalData || !evalData.years || evalData.years.length === 0) continue;
          
          if (!isNaN(constructionYear) && constructionYear > 0) {
            const maxYear = Math.max(...evalData.years);
            const offsetForward = maxYear - constructionYear;
            if (offsetForward > maxYearsForwardAll) {
               maxYearsForwardAll = offsetForward;
            }
          }
        }

        if (maxYears > 22) maxYears = 22;
        if (maxYears < 10) maxYears = 22;

        const aggData = Array.from({ length: maxYears + 1 }, () => ({
          count: 0,
          condSum: 0,
          distSum: 0,
          rideSum: 0,
          acpSum: 0,
          punchSum: 0,
          pccSum: 0,
        }));

        const aggDataForward = Array.from({ length: maxYearsForward + 1 }, () => ({
          count: 0,
          condSum: 0,
          distSum: 0,
          rideSum: 0,
          acpSum: 0,
          punchSum: 0,
          pccSum: 0,
        }));

        const aggDataForwardAll = Array.from({ length: maxYearsForwardAll + 1 }, () => ({
          count: 0, condSum: 0, distSum: 0, rideSum: 0, acpSum: 0, punchSum: 0, pccSum: 0,
        }));

        const aggDataForwardInService = Array.from({ length: maxYearsForwardInService + 1 }, () => ({
          count: 0, condSum: 0, distSum: 0, rideSum: 0, acpSum: 0, punchSum: 0, pccSum: 0,
        }));

        let validSectionsCount = 0;
        let validSectionsCountAll = 0;
        let validSectionsCountInService = 0;

        for (const row of verifiedRowsRecon) {
          const uniqueId = row['ID'] || row['S/N'];
          const actualEOL = actualEndOfLifeMapRecon[uniqueId];
          const eolToUse = actualEOL || row['End of Life'];
          const terminalYear = parseInt(eolToUse, 10);
          
          let constructionYear = Number(row['Year Constructed']);
          if (actualYearConstMapRecon[uniqueId]) constructionYear = Number(actualYearConstMapRecon[uniqueId]);

          const endRef = Number(row['End Ref'] || row['New End Ref'] || 0);
          const beginRef = Number(row['Begin Ref'] || row['New Begin Ref'] || 0);
          const laneMiles = Math.abs(endRef - beginRef) || 1; // Used for context if needed, but not for weighting here

          const evalData = buildEvalData(pmisDetailMap, row);
          const distData = buildDistressData(pmisDetailMap, row);
          
          if (!evalData || !evalData.years || evalData.years.length === 0) continue;

          let sectionHadData = false;

          if (!isNaN(terminalYear)) {
            for (let y = 0; y <= maxYears; y++) {
              const targetYear = terminalYear - y;
              const targetIdx = evalData.years.indexOf(targetYear);
              
              if (targetIdx !== -1) {
                const cond = evalData.conditionScore[targetIdx];
                const dist = evalData.distressScore[targetIdx];
                const ride = evalData.rideScore[targetIdx];
                
                const acp = distData.acpPerMile ? distData.acpPerMile[targetIdx] : null;
                const punch = distData.punchPerMile ? distData.punchPerMile[targetIdx] : null;
                const pcc = distData.pccPerMile ? distData.pccPerMile[targetIdx] : null;
                
                if (cond !== null || dist !== null || acp !== null || punch !== null || pcc !== null) {
                  sectionHadData = true;
                  aggData[y].count += 1;
                  if (cond !== null) aggData[y].condSum += cond;
                  if (dist !== null) aggData[y].distSum += dist;
                  if (ride !== null) aggData[y].rideSum += ride;
                  if (acp !== null) aggData[y].acpSum += acp;
                  if (punch !== null) aggData[y].punchSum += punch;
                  if (pcc !== null) aggData[y].pccSum += pcc;
                }
              }
            }
          }

          if (!isNaN(constructionYear) && constructionYear > 0) {
            for (let y = 0; y <= maxYearsForward; y++) {
              const targetYear = constructionYear + y;
              const targetIdx = evalData.years.indexOf(targetYear);
              
              if (targetIdx !== -1) {
                const cond = evalData.conditionScore[targetIdx];
                const dist = evalData.distressScore[targetIdx];
                const ride = evalData.rideScore[targetIdx];
                
                const acp = distData.acpPerMile ? distData.acpPerMile[targetIdx] : null;
                const punch = distData.punchPerMile ? distData.punchPerMile[targetIdx] : null;
                const pcc = distData.pccPerMile ? distData.pccPerMile[targetIdx] : null;
                
                if (cond !== null || dist !== null || acp !== null || punch !== null || pcc !== null) {
                  sectionHadData = true; // or track separately for valid forward sections
                  aggDataForward[y].count += 1;
                  if (cond !== null) aggDataForward[y].condSum += cond;
                  if (dist !== null) aggDataForward[y].distSum += dist;
                  if (ride !== null) aggDataForward[y].rideSum += ride;
                  if (acp !== null) aggDataForward[y].acpSum += acp;
                  if (punch !== null) aggDataForward[y].punchSum += punch;
                  if (pcc !== null) aggDataForward[y].pccSum += pcc;
                }
              }
            }
          }
          
          if (sectionHadData) {
            validSectionsCount++;
          }
        }

        for (const row of verifiedRowsInService) {
          const uniqueId = row['ID'] || row['S/N'];
          let constructionYear = Number(row['Year Constructed']);
          if (actualYearConstMapInService[uniqueId]) constructionYear = Number(actualYearConstMapInService[uniqueId]);

          const evalData = buildEvalData(pmisDetailMap, row);
          const distData = buildDistressData(pmisDetailMap, row);
          
          if (!evalData || !evalData.years || evalData.years.length === 0) continue;

          let sectionHadData = false;

          if (!isNaN(constructionYear) && constructionYear > 0) {
            for (let y = 0; y <= maxYearsForwardInService; y++) {
              const targetYear = constructionYear + y;
              const targetIdx = evalData.years.indexOf(targetYear);
              
              if (targetIdx !== -1) {
                const cond = evalData.conditionScore[targetIdx];
                const dist = evalData.distressScore[targetIdx];
                const ride = evalData.rideScore[targetIdx];
                
                const acp = distData.acpPerMile ? distData.acpPerMile[targetIdx] : null;
                const punch = distData.punchPerMile ? distData.punchPerMile[targetIdx] : null;
                const pcc = distData.pccPerMile ? distData.pccPerMile[targetIdx] : null;
                
                if (cond !== null || dist !== null || acp !== null || punch !== null || pcc !== null) {
                  sectionHadData = true;
                  aggDataForwardInService[y].count += 1;
                  if (cond !== null) aggDataForwardInService[y].condSum += cond;
                  if (dist !== null) aggDataForwardInService[y].distSum += dist;
                  if (ride !== null) aggDataForwardInService[y].rideSum += ride;
                  if (acp !== null) aggDataForwardInService[y].acpSum += acp;
                  if (punch !== null) aggDataForwardInService[y].punchSum += punch;
                  if (pcc !== null) aggDataForwardInService[y].pccSum += pcc;
                }
              }
            }
          }
          
          if (sectionHadData) {
            validSectionsCountInService++;
          }
        }

        for (const row of verifiedRowsAll) {
          const uniqueId = row['ID'] || row['S/N'];
          let constructionYear = Number(row['Year Constructed']);
          if (actualYearConstMapAll[uniqueId]) constructionYear = Number(actualYearConstMapAll[uniqueId]);

          const evalData = buildEvalData(pmisDetailMap, row);
          const distData = buildDistressData(pmisDetailMap, row);
          
          if (!evalData || !evalData.years || evalData.years.length === 0) continue;

          let sectionHadData = false;

          if (!isNaN(constructionYear) && constructionYear > 0) {
            for (let y = 0; y <= maxYearsForwardAll; y++) {
              const targetYear = constructionYear + y;
              const targetIdx = evalData.years.indexOf(targetYear);
              
              if (targetIdx !== -1) {
                const cond = evalData.conditionScore[targetIdx];
                const dist = evalData.distressScore[targetIdx];
                const ride = evalData.rideScore[targetIdx];
                
                const acp = distData.acpPerMile ? distData.acpPerMile[targetIdx] : null;
                const punch = distData.punchPerMile ? distData.punchPerMile[targetIdx] : null;
                const pcc = distData.pccPerMile ? distData.pccPerMile[targetIdx] : null;
                
                if (cond !== null || dist !== null || acp !== null || punch !== null || pcc !== null) {
                  sectionHadData = true;
                  aggDataForwardAll[y].count += 1;
                  if (cond !== null) aggDataForwardAll[y].condSum += cond;
                  if (dist !== null) aggDataForwardAll[y].distSum += dist;
                  if (ride !== null) aggDataForwardAll[y].rideSum += ride;
                  if (acp !== null) aggDataForwardAll[y].acpSum += acp;
                  if (punch !== null) aggDataForwardAll[y].punchSum += punch;
                  if (pcc !== null) aggDataForwardAll[y].pccSum += pcc;
                }
              }
            }
          }
          
          if (sectionHadData) {
            validSectionsCountAll++;
          }
        }

        const labels = [];
        const avgCond = [];
        const avgDist = [];
        const avgRide = [];
        const avgAcp = [];
        const avgPunch = [];
        const avgPcc = [];
        const counts = [];

        for (let y = 0; y <= maxYears; y++) {
          const d = aggData[y];
          labels.push(y);
          counts.push(d.count);
          if (d.count > 0) {
            avgCond.push(d.condSum / d.count);
            avgDist.push(d.distSum / d.count);
            avgRide.push(d.rideSum / d.count);
            avgAcp.push(d.acpSum / d.count);
            avgPunch.push(d.punchSum / d.count);
            avgPcc.push(d.pccSum / d.count);
          } else {
            avgCond.push(null);
            avgDist.push(null);
            avgRide.push(null);
            avgAcp.push(null);
            avgPunch.push(null);
            avgPcc.push(null);
          }
        }

        const labelsForward = [];
        const avgCondForward = [];
        const avgDistForward = [];
        const avgRideForward = [];
        const avgAcpForward = [];
        const avgPunchForward = [];
        const avgPccForward = [];
        const countsForward = [];

        for (let y = 0; y <= maxYearsForward; y++) {
          const d = aggDataForward[y];
          labelsForward.push(y);
          countsForward.push(d.count);
          if (d.count > 0) {
            avgCondForward.push(d.condSum / d.count);
            avgDistForward.push(d.distSum / d.count);
            avgRideForward.push(d.rideSum / d.count);
            avgAcpForward.push(d.acpSum / d.count);
            avgPunchForward.push(d.punchSum / d.count);
            avgPccForward.push(d.pccSum / d.count);
          } else {
            avgCondForward.push(null);
            avgDistForward.push(null);
            avgRideForward.push(null);
            avgAcpForward.push(null);
            avgPunchForward.push(null);
            avgPccForward.push(null);
          }
        }

        const labelsForwardAll = [];
        const avgCondForwardAll = [];
        const avgDistForwardAll = [];
        const avgRideForwardAll = [];
        const avgAcpForwardAll = [];
        const avgPunchForwardAll = [];
        const avgPccForwardAll = [];
        const countsForwardAll = [];

        for (let y = 0; y <= maxYearsForwardAll; y++) {
          const d = aggDataForwardAll[y];
          labelsForwardAll.push(y);
          countsForwardAll.push(d.count);
          if (d.count > 0) {
            avgCondForwardAll.push(d.condSum / d.count);
            avgDistForwardAll.push(d.distSum / d.count);
            avgRideForwardAll.push(d.rideSum / d.count);
            avgAcpForwardAll.push(d.acpSum / d.count);
            avgPunchForwardAll.push(d.punchSum / d.count);
            avgPccForwardAll.push(d.pccSum / d.count);
          } else {
            avgCondForwardAll.push(null);
            avgDistForwardAll.push(null);
            avgRideForwardAll.push(null);
            avgAcpForwardAll.push(null);
            avgPunchForwardAll.push(null);
            avgPccForwardAll.push(null);
          }
        }

        const labelsForwardInService = [];
        const avgCondForwardInService = [];
        const avgDistForwardInService = [];
        const avgRideForwardInService = [];
        const avgAcpForwardInService = [];
        const avgPunchForwardInService = [];
        const avgPccForwardInService = [];
        const countsForwardInService = [];

        for (let y = 0; y <= maxYearsForwardInService; y++) {
          const d = aggDataForwardInService[y];
          labelsForwardInService.push(y);
          countsForwardInService.push(d.count);
          if (d.count > 0) {
            avgCondForwardInService.push(d.condSum / d.count);
            avgDistForwardInService.push(d.distSum / d.count);
            avgRideForwardInService.push(d.rideSum / d.count);
            avgAcpForwardInService.push(d.acpSum / d.count);
            avgPunchForwardInService.push(d.punchSum / d.count);
            avgPccForwardInService.push(d.pccSum / d.count);
          } else {
            avgCondForwardInService.push(null);
            avgDistForwardInService.push(null);
            avgRideForwardInService.push(null);
            avgAcpForwardInService.push(null);
            avgPunchForwardInService.push(null);
            avgPccForwardInService.push(null);
          }
        }

        if (active) {
          setChartData({
            empty: false,
            labels,
            avgCond,
            avgDist,
            avgRide,
            avgAcp,
            avgPunch,
            avgPcc,
            counts,
            labelsForward,
            avgCondForward,
            avgDistForward,
            avgRideForward,
            avgAcpForward,
            avgPunchForward,
            avgPccForward,
            countsForward,
            labelsForwardAll,
            avgCondForwardAll,
            avgDistForwardAll,
            avgRideForwardAll,
            avgAcpForwardAll,
            avgPunchForwardAll,
            avgPccForwardAll,
            countsForwardAll,
            labelsForwardInService,
            avgCondForwardInService,
            avgDistForwardInService,
            avgRideForwardInService,
            avgAcpForwardInService,
            avgPunchForwardInService,
            avgPccForwardInService,
            countsForwardInService,
            validSectionsCount,
            totalSections: verifiedRowsRecon.length,
            validSectionsCountAll,
            totalSectionsAll: verifiedRowsAll.length,
            validSectionsCountInService,
            totalSectionsInService: verifiedRowsInService.length
          });
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          console.error('Error loading Before Terminal PMIS data:', err);
          setError(err.message || 'Error processing data');
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => { active = false; };
  }, [mode]);

  if (isLoading) {
    return (
      <div className="workspace empty-workspace">
        <div className="empty-state">
          <div className="loading-spinner" />
          <h2 style={{ marginTop: 16 }}>Analyzing Before Terminal Data...</h2>
          <p className="text-muted">Aggregating condition and distress scores leading up to terminal year.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspace empty-workspace">
        <div className="empty-state">
          <h2>Error Loading Data</h2>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (chartData?.empty || chartData?.validSectionsCount === 0) {
    return (
      <div className="workspace empty-workspace">
        <div className="empty-state">
          <h2>No Verified Data Available</h2>
          <p className="text-muted">Please run the PMIS verification process first.</p>
        </div>
      </div>
    );
  }

  const { 
    labels, avgCond, avgDist, avgRide, avgAcp, avgPunch, avgPcc, counts,
    labelsForward, avgCondForward, avgDistForward, avgRideForward, avgAcpForward, avgPunchForward, avgPccForward, countsForward,
    labelsForwardAll, avgCondForwardAll, avgDistForwardAll, avgRideForwardAll, avgAcpForwardAll, avgPunchForwardAll, avgPccForwardAll, countsForwardAll,
    labelsForwardInService, avgCondForwardInService, avgDistForwardInService, avgRideForwardInService, avgAcpForwardInService, avgPunchForwardInService, avgPccForwardInService, countsForwardInService
  } = chartData;

  const scoreChartData = [
    { x: labels, y: avgCond, type: 'scatter', mode: 'lines', name: 'Condition Score', line: { color: '#2ca02c', width: 3 } },
    { x: labels, y: avgDist, type: 'scatter', mode: 'lines', name: 'Distress Score', line: { color: '#1f77b4', width: 3 } },
    { x: labels, y: avgRide, type: 'scatter', mode: 'lines', name: 'Ride Score', line: { color: '#d62728', width: 3 }, yaxis: 'y2' },
  ];

  const scoreChartLayout = {
    template: 'plotly_white',
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    margin: { t: 60, b: 80, l: 80, r: 80 },
    font: { color: 'black', family: 'Arial' },
    xaxis: { 
      title: { text: '<b>Year(s) Before Reconstruction</b>', font: { size: 22, color: 'black' } }, 
      tickmode: 'linear',
      dtick: 2,
      tickangle: -45,
      tickfont: { size: 16 },
      showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside'
    },
    yaxis: { 
      title: { text: '<b>Average Distress & Condition Score</b>', font: { size: 22, color: 'black' } }, 
      range: [0, 100],
      tickfont: { size: 16 },
      showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside', gridcolor: 'rgba(0,0,0,0.1)'
    },
    yaxis2: { 
      title: { text: '<b>Average Ride Score</b>', font: { size: 22, color: 'black' } }, 
      range: [0, 5], 
      overlaying: 'y', 
      side: 'right',
      tickfont: { size: 16 },
      showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside', gridcolor: 'rgba(0,0,0,0.0)'
    },
    legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1, bgcolor: 'rgba(255,255,255,0.7)', bordercolor: '#ccc', borderwidth: 1, font: { size: 16 } }
  };

  const distressChartData = [
    { x: labels, y: avgPunch, type: 'bar', name: 'Punchouts', marker: { color: '#d62728', line: { color: '#000', width: 0.8 } } },
    { x: labels, y: avgAcp, type: 'bar', name: 'ACP Patches', marker: { color: '#1f77b4', line: { color: '#000', width: 0.8 } } },
    { x: labels, y: avgPcc, type: 'bar', name: 'PCC Patches', marker: { color: '#555555', line: { color: '#000', width: 0.8 } } },
    { x: labels, y: counts, type: 'scatter', mode: 'lines', name: 'Number of Sections', line: { color: 'black', width: 2.5 }, yaxis: 'y2' },
  ];

  const distressChartLayout = {
    template: 'plotly_white',
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    margin: { t: 60, b: 80, l: 80, r: 80 },
    font: { color: 'black', family: 'Arial' },
    barmode: 'stack',
    xaxis: { 
      title: { text: '<b>Year(s) Before Reconstruction</b>', font: { size: 22, color: 'black' } }, 
      tickmode: 'linear',
      dtick: 2,
      tickangle: -45,
      tickfont: { size: 16 },
      showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside'
    },
    yaxis: { 
      title: { text: '<b>Avg. distress per centerline mile</b>', font: { size: 22, color: 'black' } },
      range: [0, 10],
      dtick: 1,
      tickfont: { size: 16 },
      showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside', gridcolor: 'rgba(0,0,0,0.1)'
    },
    yaxis2: { 
      title: { text: '<b>Number of Sections</b>', font: { size: 22, color: 'black' } }, 
      overlaying: 'y', 
      side: 'right', 
      range: [0, 140],
      dtick: 20,
      tickfont: { size: 16 },
      showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside', gridcolor: 'rgba(0,0,0,0.0)'
    },
    legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1, bgcolor: 'rgba(255,255,255,0.7)', bordercolor: '#ccc', borderwidth: 1, font: { size: 16 } }
  };

  const scoreChartDataForward = [
    { x: labelsForward, y: avgCondForward, type: 'scatter', mode: 'lines', name: 'Condition Score', line: { color: '#2ca02c', width: 3 } },
    { x: labelsForward, y: avgDistForward, type: 'scatter', mode: 'lines', name: 'Distress Score', line: { color: '#1f77b4', width: 3 } },
    { x: labelsForward, y: avgRideForward, type: 'scatter', mode: 'lines', name: 'Ride Score', line: { color: '#d62728', width: 3 }, yaxis: 'y2' },
  ];

  const scoreChartLayoutForward = {
    ...scoreChartLayout,
    xaxis: { 
      ...scoreChartLayout.xaxis,
      title: { text: '<b>Years Since Construction (Age)</b>', font: { size: 22, color: 'black' } }
    }
  };

  const distressChartDataForward = [
    { x: labelsForward, y: avgPunchForward, type: 'bar', name: 'Punchouts', marker: { color: '#d62728', line: { color: '#000', width: 0.8 } } },
    { x: labelsForward, y: avgAcpForward, type: 'bar', name: 'ACP Patches', marker: { color: '#1f77b4', line: { color: '#000', width: 0.8 } } },
    { x: labelsForward, y: avgPccForward, type: 'bar', name: 'PCC Patches', marker: { color: '#555555', line: { color: '#000', width: 0.8 } } },
    { x: labelsForward, y: countsForward, type: 'scatter', mode: 'lines', name: 'Number of Sections', line: { color: 'black', width: 2.5 }, yaxis: 'y2' },
  ];

  const distressChartLayoutForward = {
    ...distressChartLayout,
    xaxis: { 
      ...distressChartLayout.xaxis,
      title: { text: '<b>Years Since Construction (Age)</b>', font: { size: 22, color: 'black' } }
    }
  };

  const scoreChartDataForwardAll = [
    { x: labelsForwardAll, y: avgCondForwardAll, type: 'scatter', mode: 'lines', name: 'Condition Score', line: { color: '#2ca02c', width: 3 } },
    { x: labelsForwardAll, y: avgDistForwardAll, type: 'scatter', mode: 'lines', name: 'Distress Score', line: { color: '#1f77b4', width: 3 } },
    { x: labelsForwardAll, y: avgRideForwardAll, type: 'scatter', mode: 'lines', name: 'Ride Score', line: { color: '#d62728', width: 3 }, yaxis: 'y2' },
  ];

  const distressChartDataForwardAll = [
    { x: labelsForwardAll, y: avgPunchForwardAll, type: 'bar', name: 'Punchouts', marker: { color: '#d62728', line: { color: '#000', width: 0.8 } } },
    { x: labelsForwardAll, y: avgAcpForwardAll, type: 'bar', name: 'ACP Patches', marker: { color: '#1f77b4', line: { color: '#000', width: 0.8 } } },
    { x: labelsForwardAll, y: avgPccForwardAll, type: 'bar', name: 'PCC Patches', marker: { color: '#555555', line: { color: '#000', width: 0.8 } } },
    { x: labelsForwardAll, y: countsForwardAll, type: 'scatter', mode: 'lines', name: 'Number of Sections', line: { color: 'black', width: 2.5 }, yaxis: 'y2' },
  ];

  const scoreChartDataForwardInService = [
    { x: labelsForwardInService, y: avgCondForwardInService, type: 'scatter', mode: 'lines', name: 'Condition Score', line: { color: '#2ca02c', width: 3 } },
    { x: labelsForwardInService, y: avgDistForwardInService, type: 'scatter', mode: 'lines', name: 'Distress Score', line: { color: '#1f77b4', width: 3 } },
    { x: labelsForwardInService, y: avgRideForwardInService, type: 'scatter', mode: 'lines', name: 'Ride Score', line: { color: '#d62728', width: 3 }, yaxis: 'y2' },
  ];

  const distressChartDataForwardInService = [
    { x: labelsForwardInService, y: avgPunchForwardInService, type: 'bar', name: 'Punchouts', marker: { color: '#d62728', line: { color: '#000', width: 0.8 } } },
    { x: labelsForwardInService, y: avgAcpForwardInService, type: 'bar', name: 'ACP Patches', marker: { color: '#1f77b4', line: { color: '#000', width: 0.8 } } },
    { x: labelsForwardInService, y: avgPccForwardInService, type: 'bar', name: 'PCC Patches', marker: { color: '#555555', line: { color: '#000', width: 0.8 } } },
    { x: labelsForwardInService, y: countsForwardInService, type: 'scatter', mode: 'lines', name: 'Number of Sections', line: { color: 'black', width: 2.5 }, yaxis: 'y2' },
  ];

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Before Terminal Trends</div>
          <div className="workspace__subtitle">Normalized pavement degradation relative to terminal year (Year 0).</div>
        </div>
        <div className="workspace__toolbar-right">
          <button className="btn btn--secondary btn--sm" onClick={() => window.location.reload()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Update Analysis
          </button>
        </div>
      </div>
      
      <div className="workspace__body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
        
        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }} open>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Total Trend (All Sections: Recon + In-Service)
          </summary>
          <div style={{ padding: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Population</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{chartData.validSectionsCountAll} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>of {chartData.totalSectionsAll} verified</span></div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
              <div style={{ height: 400 }}>
                <PlotlyChart
                  data={scoreChartDataForwardAll}
                  layout={scoreChartLayoutForward}
                  config={{ displayModeBar: true, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ height: 400 }}>
                <PlotlyChart
                  data={distressChartDataForwardAll}
                  layout={distressChartLayoutForward}
                  config={{ displayModeBar: true, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>
        </details>
        
        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }} open>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Total Trend (In-Service Only)
          </summary>
          <div style={{ padding: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Population</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{chartData.validSectionsCountInService} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>of {chartData.totalSectionsInService} verified</span></div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
              <div style={{ height: 400 }}>
                <PlotlyChart
                  data={scoreChartDataForwardInService}
                  layout={scoreChartLayoutForward}
                  config={{ displayModeBar: true, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ height: 400 }}>
                <PlotlyChart
                  data={distressChartDataForwardInService}
                  layout={distressChartLayoutForward}
                  config={{ displayModeBar: true, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>
        </details>

        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }} open>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Total Trend (Reconstructed Only)
          </summary>
          <div style={{ padding: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Population</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{chartData.validSectionsCount} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>of {chartData.totalSections} verified</span></div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
              <div style={{ height: 400 }}>
                <PlotlyChart
                  data={scoreChartDataForward}
                  layout={scoreChartLayoutForward}
                  config={{ displayModeBar: true, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ height: 400 }}>
                <PlotlyChart
                  data={distressChartDataForward}
                  layout={distressChartLayoutForward}
                  config={{ displayModeBar: true, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>
        </details>

        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }} open>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Before Terminal Averages
          </summary>
          <div style={{ padding: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Population</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{chartData.validSectionsCount} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>of {chartData.totalSections} verified</span></div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
              <div style={{ height: 400 }}>
                <PlotlyChart
                  data={scoreChartData}
                  layout={scoreChartLayout}
                  config={{ displayModeBar: true, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ height: 400 }}>
                <PlotlyChart
                  data={distressChartData}
                  layout={distressChartLayout}
                  config={{ displayModeBar: true, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
