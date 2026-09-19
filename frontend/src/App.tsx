import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { TopNav } from './components/layout/TopNav';
import { LeftSidebar, NavTab } from './components/layout/LeftSidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomPanel } from './components/layout/BottomPanel';
import { Viewport3D } from './components/three/Viewport3D';
import { TopView2D } from './components/layout/TopView2D';
import { VolumeTool } from './components/layout/VolumeTool';
import { CrossSectionTool } from './components/layout/CrossSectionTool';
import { QAQCTool } from './components/layout/QAQCTool';
import { MetadataView } from './components/layout/MetadataView';
import { ContoursView } from './components/layout/ContoursView';
import { PointTableStudio } from './components/layout/PointTableStudio';
import { ProjectStatisticsStudio } from './components/layout/ProjectStatisticsStudio';
import { FileUploadModal } from './components/preview/FileUploadModal';
import { ColumnMappingModal } from './components/preview/ColumnMappingModal';
import { ValidationReportModal } from './components/preview/ValidationReportModal';
import { ExportModal } from './components/preview/ExportModal';
import { SettingsModal } from './components/layout/SettingsModal';
import { HelpModal } from './components/layout/HelpModal';
import { Footer } from './components/layout/Footer';
import { RawPreviewResponse, ValidationSummary, ColumnMapping } from './types/survey';
import { surveyApi } from './services/api';
import { formatNumber, formatInteger } from './utils/formatters';
import { generateSampleSurveyProject } from './utils/sampleProjectData';

export function App() {
  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<NavTab>('3d');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Project & Data State
  const [projectName, setProjectName] = useState<string>('Untitled_Survey_Project');
  const [status, setStatus] = useState<'idle' | 'uploaded' | 'validating' | 'validated' | 'ready'>('idle');
  const [previewData, setPreviewData] = useState<RawPreviewResponse | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [tinData, setTinData] = useState<any | null>(null);
  const [demData, setDemData] = useState<any | null>(null);
  const [contoursData, setContoursData] = useState<any | null>(null);
  const [projectStats, setProjectStats] = useState<any | null>(null);
  const [confirmedMapping, setConfirmedMapping] = useState<ColumnMapping | null>(null);
  const [confirmedCrs, setConfirmedCrs] = useState<string | null>(null);
  const [confirmedDatum, setConfirmedDatum] = useState<string>('Local TBM');

  const [isValidating, setIsValidating] = useState(false);
  const [isGeneratingSurface, setIsGeneratingSurface] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [cursorCoord, setCursorCoord] = useState<{ x: number; y: number; z: number } | null>(null);

  // Load Demo Project helper (Available only if explicitly requested)
  const handleLoadDemoProject = (demoName = 'Khagrachari_1000Acre_Survey') => {
    const demo = generateSampleSurveyProject(demoName);
    setProjectName(demo.projectName);
    setPreviewData(demo.previewData);
    setConfirmedMapping(demo.previewData.detected_columns);
    setConfirmedCrs('EPSG:32646');
    setConfirmedDatum('PWD Datum');
    setValidationSummary(demo.summary);
    setTinData(demo.tinData);
    setDemData(demo.demData);
    setContoursData(demo.contoursData);
    setProjectStats(demo.projectStats);
    setStatus('ready');
    setIsUploadOpen(false);
  };


  // Display Settings
  const [surfaceStyle, setSurfaceStyle] = useState<string>('elevation');
  const [colorMap, setColorMap] = useState<string>('elevation');
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(2.0);
  const [hillshadeEnabled, setHillshadeEnabled] = useState<boolean>(true);
  const [hillshadeAzimuth, setHillshadeAzimuth] = useState<number>(315);
  const [hillshadeAltitude, setHillshadeAltitude] = useState<number>(45);
  const [pointSize, setPointSize] = useState<number>(2);
  const [opacity, setOpacity] = useState<number>(1.0);
  const [showSkirt, setShowSkirt] = useState<boolean>(false);
  const [smoothShading, setSmoothShading] = useState<boolean>(false);
  const [showAxes, setShowAxes] = useState<boolean>(false);
  const [meshDensity, setMeshDensity] = useState<'classic' | 'full' | 'sparse'>('classic');
  const [inspectorEnabled, setInspectorEnabled] = useState<boolean>(true);
  const [contourInterval, setContourInterval] = useState<number>(1.0);
  const [units, setUnits] = useState({ horizontal: 'meter', vertical: 'meter' });

  // Layer Controls
  const [layers, setLayers] = useState({
    surface: true,
    points: true,
    pointLabels: false,
    wireframe: false,
    contour: true,
    contourLabels: false,
    hillshade: true,
  });

  const handleToggleLayer = (layer: keyof typeof layers) => {
    setLayers((prev) => {
      const nextVal = !prev[layer];
      if (layer === 'hillshade') {
        setHillshadeEnabled(nextVal);
      }
      return { ...prev, [layer]: nextVal };
    });
  };

  // Upload callback
  const handleUploadSuccess = (data: RawPreviewResponse) => {
    setPreviewData(data);
    setIsUploadOpen(false);
    setIsMappingOpen(true);
    setStatus('uploaded');
    const cleanName = data.filename.replace(/\.[^/.]+$/, '').replace(/[\s-]+/g, '_');
    setProjectName(cleanName);
  };

  // Validate callback
  const handleConfirmValidate = async (
    mapping: ColumnMapping,
    sourceCrs: string | null,
    verticalDatum: string,
    horizontalUnit: string,
    verticalUnit: string
  ) => {
    if (!previewData) return;
    setIsValidating(true);
    setStatus('validating');
    setConfirmedMapping(mapping);
    setConfirmedCrs(sourceCrs);
    setConfirmedDatum(verticalDatum);
    try {
      const summary = await surveyApi.validateData({
        file_id: previewData.file_id,
        column_mapping: mapping,
        has_headers: previewData.has_headers,
        source_crs: sourceCrs,
        vertical_datum: verticalDatum,
        horizontal_unit: horizontalUnit,
        vertical_unit: verticalUnit,
      });
      setValidationSummary(summary);
      setIsMappingOpen(false);
      setIsValidationOpen(true);
      setStatus('validated');
    } catch (err: any) {
      alert(`Validation error: ${err.response?.data?.message || err.message}`);
      setStatus('uploaded');
    } finally {
      setIsValidating(false);
    }
  };

  // Proceed with Valid Points -> Generate Surface TIN, DEM, and Contours concurrently!
  const handleProceedWithValid = async () => {
    if (!previewData || !confirmedMapping) return;
    setIsValidationOpen(false);
    setIsGeneratingSurface(true);
    setStatus('validating');
    try {
      // 1. Generate TIN & Stats
      const resTin = await surveyApi.generateSurface({
        file_id: previewData.file_id,
        column_mapping: confirmedMapping,
        source_crs: confirmedCrs,
        vertical_datum: confirmedDatum,
      });
      const tinObj = resTin.tin || resTin;
      setTinData(tinObj);
      setProjectStats(resTin.statistics || resTin.projectStats || resTin.stats);
      if (tinObj?.sample_points?.length > 0) {
        setSelectedPoint(tinObj.sample_points[0]);
      }

      // 2. Generate DEM & Hillshade in background
      surveyApi.generateDEM({
        file_id: previewData.file_id,
        column_mapping: confirmedMapping,
        source_crs: confirmedCrs,
        resolution: 1.0,
        azimuth: hillshadeAzimuth,
        altitude: hillshadeAltitude,
      }).then((resDem) => setDemData(resDem.dem || resDem)).catch(() => {});

      // 3. Generate Vector Contours in background
      surveyApi.generateContours({
        file_id: previewData.file_id,
        column_mapping: confirmedMapping,
        source_crs: confirmedCrs,
        interval: contourInterval,
        major_multiplier: 5,
        resolution: 1.0,
      }).then((resCont) => setContoursData(resCont.contours || resCont)).catch(() => {});

      setStatus('ready');
    } catch (err: any) {
      alert(`Surface generation error: ${err.response?.data?.detail || err.response?.data?.message || err.message}`);
      setStatus('validated');
    } finally {
      setIsGeneratingSurface(false);
    }
  };

  const handleResetView = () => {
    setVerticalExaggeration(2.0);
    setSurfaceStyle('elevation');
    setColorMap('elevation');
    setHillshadeEnabled(true);
    setPointSize(2);
    setOpacity(1.0);
    setShowSkirt(false);
    setSmoothShading(false);
    setMeshDensity('classic');
    setInspectorEnabled(true);
  };

  const is2DTab = ['2d', 'hillshade', 'slope'].includes(activeTab);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Navigation */}
      <TopNav
        projectName={projectName}
        status={status}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenReport={() => setIsValidationOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          projectName={projectName}
          fileName={previewData?.filename}
          summary={validationSummary}
          tinData={tinData}
          projectStats={projectStats}
          sourceCrs={confirmedCrs}
          verticalDatum={confirmedDatum}
          colorMap={colorMap}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onOpenReport={() => setIsValidationOpen(true)}
        />

        {/* Center Main Viewport Area */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            {activeTab === 'volume' ? (
              <VolumeTool
                fileId={previewData?.file_id}
                columnMapping={confirmedMapping}
                sourceCrs={confirmedCrs}
                minElevation={validationSummary?.bounds?.min_z}
                maxElevation={validationSummary?.bounds?.max_z}
              />
            ) : activeTab === 'profile' ? (
              <CrossSectionTool
                fileId={previewData?.file_id}
                columnMapping={confirmedMapping}
                sourceCrs={confirmedCrs}
                bounds={validationSummary?.bounds}
                contoursData={contoursData}
                tinData={tinData}
              />
            ) : activeTab === 'qaqc' ? (
              <QAQCTool
                summary={validationSummary}
                tinData={tinData}
              />
            ) : activeTab === 'metadata' ? (
              <MetadataView
                projectName={projectName}
                fileName={previewData?.filename}
                summary={validationSummary}
                projectStats={projectStats}
                tinData={tinData}
                sourceCrs={confirmedCrs}
                verticalDatum={confirmedDatum}
              />
            ) : activeTab === 'contours' ? (
              <ContoursView
                fileId={previewData?.file_id}
                columnMapping={confirmedMapping}
                sourceCrs={confirmedCrs}
                contoursData={contoursData}
                onUpdateContours={setContoursData}
              />
            ) : activeTab === 'points' ? (
              <PointTableStudio
                summary={validationSummary}
                onSelectPoint={setSelectedPoint}
                sourceCrs={confirmedCrs}
                projectName={projectName}
              />
            ) : activeTab === 'stats' ? (
              <ProjectStatisticsStudio
                summary={validationSummary}
                projectStats={projectStats}
                tinData={tinData}
                sourceCrs={confirmedCrs}
                verticalDatum={confirmedDatum}
                projectName={projectName}
                fileId={previewData?.file_id}
                columnMapping={confirmedMapping}
              />
            ) : is2DTab ? (
              <TopView2D
                fileId={previewData?.file_id}
                columnMapping={confirmedMapping}
                sourceCrs={confirmedCrs}
                demData={demData}
                contoursData={contoursData}
                tinData={tinData}
                bounds={validationSummary?.bounds}
                onSelectPoint={setSelectedPoint}
                onUpdateDemData={setDemData}
              />
            ) : (
              <>
                <Viewport3D
                  projectName={projectName}
                  summary={validationSummary}
                  tinData={tinData}
                  contoursData={contoursData}
                  verticalExaggeration={verticalExaggeration}
                  surfaceStyle={surfaceStyle}
                  colorMap={colorMap}
                  meshDensity={meshDensity}
                  onChangeMeshDensity={setMeshDensity}
                  pointSize={pointSize}
                  opacity={opacity}
                  hillshadeEnabled={hillshadeEnabled}
                  hillshadeAzimuth={hillshadeAzimuth}
                  hillshadeAltitude={hillshadeAltitude}
                  showSkirt={showSkirt}
                  onToggleSkirt={setShowSkirt}
                  smoothShading={smoothShading}
                  onToggleSmoothShading={setSmoothShading}
                  inspectorEnabled={inspectorEnabled}
                  onToggleInspector={setInspectorEnabled}
                  showAxes={showAxes}
                  onToggleAxes={setShowAxes}
                  layers={layers}
                  onToggleLayer={handleToggleLayer}
                  onCursorMove={setCursorCoord}
                  onSelectPoint={setSelectedPoint}
                />

                {/* Floating Bottom Inspection Drawer (3D Mode) */}
                <BottomPanel
                  summary={validationSummary}
                  projectStats={projectStats}
                  selectedPoint={selectedPoint}
                  cursorCoord={cursorCoord}
                  verticalExaggeration={verticalExaggeration}
                />

                {/* Sliding Right Display Settings Drawer (3D Mode) */}
                <RightSidebar
                  tinData={tinData}
                  projectName={projectName}
                  surfaceStyle={surfaceStyle}
                  onChangeSurfaceStyle={setSurfaceStyle}
                  colorMap={colorMap}
                  onChangeColorMap={setColorMap}
                  meshDensity={meshDensity}
                  onChangeMeshDensity={setMeshDensity}
                  verticalExaggeration={verticalExaggeration}
                  onChangeVerticalExaggeration={setVerticalExaggeration}
                  hillshadeEnabled={hillshadeEnabled}
                  onToggleHillshade={(val) => {
                    setHillshadeEnabled(val);
                    setLayers((prev) => ({ ...prev, hillshade: val }));
                  }}
                  hillshadeAzimuth={hillshadeAzimuth}
                  onChangeHillshadeAzimuth={setHillshadeAzimuth}
                  hillshadeAltitude={hillshadeAltitude}
                  onChangeHillshadeAltitude={setHillshadeAltitude}
                  inspectorEnabled={inspectorEnabled}
                  onToggleInspector={setInspectorEnabled}
                  showAxes={showAxes}
                  onToggleAxes={setShowAxes}
                  pointSize={pointSize}
                  onChangePointSize={setPointSize}
                  opacity={opacity}
                  onChangeOpacity={setOpacity}
                  showSkirt={showSkirt}
                  onToggleSkirt={setShowSkirt}
                  smoothShading={smoothShading}
                  onToggleSmoothShading={setSmoothShading}
                  onResetView={handleResetView}
                />
              </>
            )}
          </div>
        </main>
      </div>

      {/* Global Status Footer */}
      <Footer />

      {/* Upload Modal */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        onLoadDemo={handleLoadDemoProject}
      />

      {/* Column Mapping & CRS Modal */}
      <ColumnMappingModal
        isOpen={isMappingOpen}
        onClose={() => setIsMappingOpen(false)}
        previewData={previewData}
        onConfirmValidate={handleConfirmValidate}
        isValidating={isValidating}
      />

      {/* Validation Report Modal */}
      <ValidationReportModal
        isOpen={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
        summary={validationSummary}
        onProceedWithValid={handleProceedWithValid}
      />

      {/* Export Center Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        fileId={previewData?.file_id}
        columnMapping={confirmedMapping}
        sourceCrs={confirmedCrs}
        verticalDatum={confirmedDatum}
        projectName={projectName}
        tinData={tinData}
        verticalExaggeration={verticalExaggeration}
        surfaceStyle={surfaceStyle}
        colorMap={colorMap}
        meshDensity={meshDensity}
        showSkirt={showSkirt}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        units={units}
        onChangeUnits={setUnits}
        currentCrs={confirmedCrs}
        currentDatum={confirmedDatum}
        onUpdateGeodesy={(newCrs, newDatum) => {
          setConfirmedCrs(newCrs);
          setConfirmedDatum(newDatum);
        }}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}

export default App;

