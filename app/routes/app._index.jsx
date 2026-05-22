import {
  useLoaderData,
} from "react-router";

import { authenticate } from "../shopify.server";

import { useEffect, useState } from "react";

import {
  Page,
  Card,
  Select,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Modal,
  DataTable,
  Spinner,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";

  const origin = new URL(request.url).origin;
  const apiRoot = process.env.VITE_API_ROOT || origin;

  const store = await fetch(`${apiRoot}/api/stores/my-store`, {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
  });

  const storeData = await store
    .json()
    .catch(() => ({ message: "Store Data Load Failed..." }));

  return {
    apiRoot,
    shop,
    storeData,
  };
};

export default function DashboardPage() {

  const { apiRoot, shop, storeData } = useLoaderData();
  const initialRunTime = storeData?.store?.run_time?.toString() || "10";

  const [stats, setStats] = useState(null);

  const [csvOptions, setCsvOptions] = useState([]);

  const [locations, setLocations] = useState([]);
  const [runTime, setRunTime] = useState(initialRunTime);
  const [syncNowDisabled, setSyncNowDisabled] = useState(false);
  const [syncNowRemaining, setSyncNowRemaining] = useState(0);

  const runTimeOptions = [
    { label: "10 minutes", value: "10" },
    { label: "20 minutes", value: "20" },
    { label: "30 minutes", value: "30" },
    { label: "45 minutes", value: "45" },
    { label: "60 minutes", value: "60" },
  ];

  const SYNC_NOW_STORAGE_KEY = "syncNowDisabledUntil";

  const updateSyncNowState = (disabledUntil) => {
    const now = Date.now();
    const remainingMs = disabledUntil - now;

    if (remainingMs > 0) {
      setSyncNowDisabled(true);
      setSyncNowRemaining(Math.ceil(remainingMs / 1000));
    } else {
      setSyncNowDisabled(false);
      setSyncNowRemaining(0);
      localStorage.removeItem(SYNC_NOW_STORAGE_KEY);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(SYNC_NOW_STORAGE_KEY);
    const disabledUntil = stored ? parseInt(stored, 10) : 0;

    if (disabledUntil && !Number.isNaN(disabledUntil)) {
      updateSyncNowState(disabledUntil);
    }

    const interval = setInterval(() => {
      const currentStored = localStorage.getItem(SYNC_NOW_STORAGE_KEY);
      const currentDisabledUntil = currentStored ? parseInt(currentStored, 10) : 0;

      if (currentDisabledUntil && !Number.isNaN(currentDisabledUntil)) {
        updateSyncNowState(currentDisabledUntil);
      } else {
        setSyncNowDisabled(false);
        setSyncNowRemaining(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Dashboard Stats
  useEffect(() => {

    fetch(`${apiRoot}/api/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
      });


    fetch(`${apiRoot}/api/locations/csv-names`)
      .then(res => res.json())
      .then(data => {

        setCsvOptions([
          { label: "Select CSV", value: "" },
          ...(data.data || [])
        ]);
      });

  }, [apiRoot]);

  // Fetch Locations
  useEffect(() => {

    fetch(`${apiRoot}/api/locations/get-locations`)
      .then(res => res.json())
      .then(data => {
        setLocations(data.data || []);
      });

  }, [apiRoot]);

  // Update Mapping
  const updateMapping = async (locationId, csvCode) => {

    try {

      await fetch(`${apiRoot}/api/locations/map-locations`, {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          location_id: locationId,
          csv_code: csvCode,
        }),
      });

      setLocations((prev) =>
        prev.map((item) =>
          item.id === locationId
            ? { ...item, csv_code: csvCode }
            : item
        )
      );

    } catch (error) {

      console.error(error);
    }
  };

  const [reportOpen, setReportOpen] = useState(false);

  const [reportLoading, setReportLoading] = useState(false);

  const [reportRows, setReportRows] = useState([]);

  const [reportTitle, setReportTitle] = useState("");

  const openReport = async (status) => {

    try {

      setReportOpen(true);

      setReportLoading(true);

      setReportRows([]);

      setReportTitle(
        status === "done"
          ? "Last 100 Processed"
          : "Last 100 Failed"
      );

      const res = await fetch(
        `${apiRoot}/report?status=${status}`
      );

      const data = await res.json();

      setReportRows(data.data || []);

    } catch (err) {

      console.log(err);

      alert("Failed loading report");

    } finally {

      setReportLoading(false);

    }

  };

  const handleMappingChange = (locationId, csvCode) => {

    setLocations((prev) =>
      prev.map((item) =>
        item.id === locationId
          ? { ...item, csv_code: csvCode }
          : item
      )
    );
  };

  const syncLocations = async () => {

    try {
      const response = await fetch(
        `${apiRoot}/api/locations/sync-locations`
      );

      const data = await response.json();

      if (response.ok) {
        window.location.reload();
      } else {
        alert(data?.message || "Failed to sync locations");
      }
    } catch (error) {
      console.log(error);
      alert("Failed to sync locations");
    }
  };

  const syncNow = async () => {
    try {
      const response = await fetch(`${apiRoot}/syncnow`);
      const data = await response.json();

      if (response.ok) {
        const disabledUntil = Date.now() + 10 * 60 * 1000;
        localStorage.setItem(SYNC_NOW_STORAGE_KEY, disabledUntil.toString());
        updateSyncNowState(disabledUntil);
        alert(data.message || "Inventory sync started");
      } else {
        alert(data?.message || "Failed to start inventory sync");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to start inventory sync");
    }
  };

  const handleRunTimeChange = async (value) => {
    const confirmed = window.confirm(
      `Update Interval To ${value} minutes `
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`${apiRoot}/api/stores/run-time`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop,
          run_time: Number(value),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRunTime(value);
        alert(data.message || "Run time updated");
      } else {
        alert(data?.message || "Failed to update run time");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to update run time");
    }
  };

  const saveMappings = async () => {

    try {

      const mappings = locations.map((location) => ({
        location_id: location.id,
        csv_code: location.csv_code || "",
      }));

      const response = await fetch(
        `${apiRoot}/api/locations/map-locations`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            mappings,
          }),
        }
      );

      const data = await response.json();

      alert(data.message);

    } catch (error) {

      console.error(error);

      alert("Failed to save mappings");
    }
  };

  return (

    <Page title="StockMaska Sync">

      <BlockStack gap="500">

        {/* Stats */}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
        }}>

          <DashboardCard
            title="Pending Queue"
            value={stats?.pending || 0}
          />

          <DashboardCard
            title="Processed"
            value={stats?.done || 0}
            textColor="green"
            clickable
            onClick={() => openReport("done")}
          />

          <DashboardCard
            title="Failed"
            value={stats?.failed || 0}
            clickable
            textColor="red"
            onClick={() => openReport("failed")}
          />

          <DashboardCard
            title="Locations"
            value={stats?.locations || 0}
          />

        </div>

        <div style={{ marginTop: "20px", marginBottom: "40px", display: "flex", gap: "12px" }}>

          <div style={{ minWidth: 180 }}>
            <Select
              label="Run time"
              labelHidden
              options={runTimeOptions}
              value={runTime}
              onChange={handleRunTimeChange}
            />
          </div>

          <Button
            variant="secondary"
            onClick={syncLocations}
          >
            Sync Locations
          </Button>

          <Button
            variant="secondary"
            onClick={syncNow}
            disabled={syncNowDisabled}
          >
            {syncNowDisabled ? `Sync Now (${syncNowRemaining}s)` : "Sync Now"}
          </Button>

          <Button
            variant="primary"
            onClick={saveMappings}
          >
            Save Mappings
          </Button>

        </div>


        {/* Location Mapping */}

        <Card>

          <div style={{ padding: "20px" }}>

            <Text variant="headingLg" as="h2">
              Location Mapping
            </Text>

            <div style={{ marginTop: "20px" }}>

              <BlockStack gap="400">

                {locations.map((location) => (

                  <Card key={location.id}>

                    <InlineStack align="space-between">

                      <Text variant="headingMd">
                        {location.store_name}
                      </Text>

                      <div style={{ width: 250 }}>

                        <Select
                          options={csvOptions}
                          value={location.csv_code || ""}
                          onChange={(value) =>
                            handleMappingChange(location.id, value)
                          }
                        />

                      </div>

                    </InlineStack>

                  </Card>
                ))}

              </BlockStack>

            </div>

          </div>

        </Card>

      </BlockStack>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={reportTitle}
        size="fullScreen"
      >
        <Modal.Section>
          <style>{`
      .Polaris-Modal-Dialog__Modal {
        max-width: 95vw !important;
        width: 95vw !important;
      }
    `}</style>

          {reportLoading ? (
            <Spinner />
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e1e3e5", textAlign: "left" }}>
                    {["Style", "SKU", "Size", "Color", "Location", "Qty", "Processed", "Result"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", whiteSpace: "nowrap", color: "#6d7175", fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e1e3e5" }}>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r.style}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r.sku}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r.size}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r.color}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r.store_name}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r.old_qty} → {r.new_qty}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r.processed_at}</td>
                      <td
                        style={{
                          padding: "8px 12px",
                          wordBreak: "break-word",
                          maxWidth: "220px",
                          color: r.error_message ? "red" : "green",
                          fontWeight: r.error_message ? 500 : 400,
                        }}
                      >
                        {r.error_message || "Success"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </Modal.Section>

      </Modal>


    </Page>
  );
}
function DashboardCard({
  title,
  value,
  clickable,
  onClick,
  textColor = "#000"
}) {
  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #ddd',
        padding: '20px',
        borderRadius: '10px',
        background: '#fff',
        cursor: clickable ? "pointer" : "default",
        transition: "0.2s"
      }}
    >
      <h3 style={{ color: textColor }}>{title}</h3>

      <h1 style={{ color: textColor }}>{value}</h1>
    </div>
  );
}