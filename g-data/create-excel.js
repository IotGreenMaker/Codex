/**
 * Create starting Excel files for GBuddy application.
 * Generates g-buddy-data.xlsx with Plants, Watering_Log, Climate_Log, and Settings sheets.
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function createPlantsSheet(plants = []) {
  const headers = [
    'ID', 'Strain Name', 'Stage', 'Started At', 'Bloom Started At',
    'Light Schedule', 'Lights On', 'Lights Off', 'Light Type', 'Light Dimmer %',
    'Container Volume (L)', 'Media Volume (L)', 'Media Type', 'Grow Temp (°C)',
    'Grow Humidity (%)', 'Water Input (ml)', 'Water pH', 'Water EC',
    'Last Watered At', 'Watering Interval (days)', 'Outside Temp (°C)', 'Outside Humidity (%)'
  ];

  const rows = plants.map(p => [
    p.id || '',
    p.strainName || 'Unknown',
    p.stage || 'Seedling',
    p.startedAt || new Date().toISOString(),
    p.bloomStartedAt || '',
    p.lightSchedule || '18 / 6',
    p.lightsOn || '06:00',
    p.lightsOff || '00:00',
    p.lightType || 'panel_100w',
    p.lightDimmerPercent || 75,
    p.containerVolumeL || 15,
    p.mediaVolumeL || 13,
    p.mediaType || 'Soil',
    p.growTempC || 24,
    p.growHumidity || 60,
    p.waterInputMl || 500,
    p.waterPh || 6.0,
    p.waterEc || 1.0,
    p.lastWateredAt || new Date().toISOString(),
    p.wateringIntervalDays || 2,
    p.outsideTempC || 20,
    p.outsideHumidity || 50,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  
  ws['!cols'] = [
    { wch: 36 }, { wch: 20 }, { wch: 10 }, { wch: 24 }, { wch: 24 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 20 },
    { wch: 16 }, { wch: 16 },
  ];

  return ws;
}

function createWateringSheet(logs = []) {
  const headers = ['ID', 'Plant ID', 'Timestamp', 'Amount (ml)', 'pH', 'EC', 'Runoff pH', 'Runoff EC'];
  const rows = logs.map(l => [l.id, l.plantId, l.timestamp, l.amountMl, l.ph, l.ec, l.runoffPh || '', l.runoffEc || '']);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 36 }, { wch: 36 }, { wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
  return ws;
}

function createClimateSheet(logs = []) {
  const headers = ['ID', 'Plant ID', 'Timestamp', 'Temp (°C)', 'Humidity (%)'];
  const rows = logs.map(l => [l.id, l.plantId, l.timestamp, l.tempC, l.humidity]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 36 }, { wch: 36 }, { wch: 24 }, { wch: 12 }, { wch: 14 }];
  return ws;
}

function createSettingsSheet(settings = []) {
  const headers = ['Key', 'Value'];
  const defaultSettings = [{ key: 'activePlantId', value: '' }, { key: 'locale', value: 'en' }, ...settings];
  const rows = defaultSettings.map(s => [s.key, s.value]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }];
  return ws;
}

function main() {
  const outputDir = __dirname;
  const outputFile = path.join(outputDir, 'g-buddy-data.xlsx');

  const samplePlants = [
    {
      id: generateUUID(), strainName: 'Sour Diesel', stage: 'Seedling',
      startedAt: new Date().toISOString(), bloomStartedAt: '',
      lightSchedule: '18 / 6', lightsOn: '06:00', lightsOff: '00:00',
      lightType: 'panel_100w', lightDimmerPercent: 75,
      containerVolumeL: 15, mediaVolumeL: 13, mediaType: 'Soil',
      growTempC: 24, growHumidity: 60, waterInputMl: 500, waterPh: 6.0, waterEc: 1.0,
      lastWateredAt: new Date().toISOString(), wateringIntervalDays: 2,
      outsideTempC: 20, outsideHumidity: 50,
    },
    {
      id: generateUUID(), strainName: 'Northern Lights', stage: 'Veg',
      startedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), bloomStartedAt: '',
      lightSchedule: '18 / 6', lightsOn: '06:00', lightsOff: '00:00',
      lightType: 'panel_100w', lightDimmerPercent: 75,
      containerVolumeL: 11, mediaVolumeL: 9, mediaType: 'Coco',
      growTempC: 23, growHumidity: 55, waterInputMl: 400, waterPh: 5.8, waterEc: 1.2,
      lastWateredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), wateringIntervalDays: 2,
      outsideTempC: 18, outsideHumidity: 45,
    },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, createPlantsSheet(samplePlants), 'Plants');
  XLSX.utils.book_append_sheet(wb, createWateringSheet([]), 'Watering_Log');
  XLSX.utils.book_append_sheet(wb, createClimateSheet([]), 'Climate_Log');
  XLSX.utils.book_append_sheet(wb, createSettingsSheet([]), 'Settings');

  XLSX.writeFile(wb, outputFile);

  console.log(`Created Excel file: ${outputFile}`);
  console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
  console.log(`Plants: ${samplePlants.length} sample entries`);
}

main();