import { useEffect, useState, useRef, useCallback } from "preact/hooks";
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import { BASE_URL } from "../config.js";

const DEFAULT_API_URL = `${BASE_URL}/apps/proxy/company-locations`;


export default function LocationDropdown({
  companyId = null,     // optional - server will resolve session if omitted
  selectedId = null,
  newlocationName,
  onSelect = () => { },
  apiUrl = DEFAULT_API_URL,
  createdLocation = null,
}) {
  
  const [filter, setFilter] = useState("");
  const [locations, setLocations] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceTimeout = useRef();

  const fetchLocations = useCallback(
    async (search = "") => {
      setLoading(true);
      setError(null);
      try {
        const token = await shopify.sessionToken.get();
        const url = new URL(apiUrl);
        if (companyId) url.searchParams.set("companyId", companyId);
        if (search) url.searchParams.set("q", search);

        const resp = await fetch(url.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
        });
        const json = await resp.json().catch(() => null);
        if (resp.ok && json?.success) {
          setCompany(json.company ?? null);
          setLocations(json.locations ?? []);
        } else {
          setCompany(null);
          setLocations([]);
          setError(json?.message || "Failed to load locations");
        }
      } catch (err) {
        console.error(err);
        setCompany(null);
        setLocations([]);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [companyId, shopify.sessionToken, apiUrl]
  );

  // initial load: get first 10 (proxy uses first=10 by default)
  useEffect(() => {
    fetchLocations("");
  }, [fetchLocations]);

  // debounce search
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    // @ts-ignore
    debounceTimeout.current = setTimeout(() => {
      fetchLocations(filter.trim());
    }, 300);
    //console.log("current_tike--",debounceTimeout.current);
    return () => clearTimeout(debounceTimeout.current);
  }, [filter, fetchLocations, createdLocation, newlocationName]);

  const selectedNode = locations.find((n) => n.id === selectedId) ?? null;
  const label = selectedNode ? selectedNode.name || "(unnamed)" : "Select location";

  const highlightMatch = (text, match) => {
    if (!match) return text;
    const regex = new RegExp(`(${match})`, "ig");
    return text.split(regex).map((part, idx) =>
      regex.test(part) ? (
        <s-text key={idx} type="strong" tone="critical">
          {part}
        </s-text>
      ) : (
        <s-text key={idx}>{part}</s-text>
      )
    );
  };

  return (
    <s-stack>
      <s-stack>
        <s-popover id="popover-locations-id" blockSize='auto'>
        <s-box background="subdued" borderRadius="base" borderWidth="base" padding="base" paddingInlineEnd='large'>
          <s-stack>
            <s-text-field
              placeholder="Search for a location"
              value={filter}
              onChange={(e) => {const val = /** @type {HTMLInputElement} */ (e.target).value; setFilter(val)}}
            />
          </s-stack>

          <s-scroll-box maxBlockSize="300px">
            {loading ? (
              <s-text>Loading…</s-text>
            ) : locations.length === 0 ? (
              <s-text>No locations</s-text>
            ) : (
              locations.map((loc) => (
                <s-box key={loc.id} background="subdued" border="base" minBlockSize="50px">
                
                  <s-clickable
                    padding="base"
                    target="auto"
                    onClick={() => {
                      // @ts-ignore
                      onSelect(loc.id, loc);
                    }}
                  >
                    <s-stack columnGap="base">
                      <s-text>
                        {highlightMatch(loc.name || "(unnamed)", filter.trim())}
                      </s-text>
                      <s-text>
                        {selectedId === loc.id && (
                          <s-icon tone="success" type='check-circle' />
                        )}
                      </s-text>
                    </s-stack>
                  </s-clickable>
                
                </s-box>
              ))
            )}
          </s-scroll-box>
        </s-box> 
        </s-popover>
      </s-stack>
      {error && (
        <s-banner tone="critical">
          <s-text>{String(error)}</s-text>
        </s-banner>
      )}
      <s-stack columnGap='base' maxBlockSize='none'>
        <s-button commandFor="popover-locations-id">
          <s-stack direction='inline' alignContent='start'>
            <s-text>{label}</s-text>
            <s-icon type='location' />
          </s-stack>
        </s-button>
      </s-stack>
    </ s-stack>
  );
}
