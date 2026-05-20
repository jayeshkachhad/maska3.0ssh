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
} from "@shopify/polaris";

export const loader = async ({ request }) => {

  await authenticate.admin(request);

  return {
    apiRoot: process.env.VITE_API_ROOT || ""
  };
};

export default function DashboardPage() {

  const { apiRoot } = useLoaderData();

  const [stats, setStats] = useState(null);

  const [csvOptions, setCsvOptions] = useState([]);

  const [locations, setLocations] = useState([]);
  const [syncNowDisabled, setSyncNowDisabled] = useState(false);
  const [syncNowRemaining, setSyncNowRemaining] = useState(0);

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
          />

          <DashboardCard
            title="Failed"
            value={stats?.failed || 0}
          />

          <DashboardCard
            title="Locations"
            value={stats?.locations || 0}
          />

        </div>

        <div style={{ marginTop: "20px", marginBottom: "40px",  display: "flex", gap: "12px" }}>

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

      
    </Page>
  );
}

function DashboardCard({ title, value }) {

  return (

    <div style={{
      border: '1px solid #ddd',
      padding: '20px',
      borderRadius: '10px',
      background: '#fff'
    }}>

      <h3>{title}</h3>

      <h1>{value}</h1>

    </div>
  );
}