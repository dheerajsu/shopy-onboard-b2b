import React, { useEffect, useState, useCallback } from "preact/hooks";
import '@shopify/ui-extensions/preact';
import { render } from 'preact';

import TeamMemberEditForm from "./TeamMemberEditForm.jsx";
import { BASE_URL } from "../config.js";

export default function TeamMembersGrid({ apiUrl, locationId, newlocationName, setPingedvalue, onEdit = () => { }, newcontactid }) {

  const editlocationmembers = `${BASE_URL}/apps/proxy/edit-location-team-members`;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [members, setMembers] = useState([]);
  const [locationName, setLocationName] = useState(null);
  const [updatedLocationName, setUpdatedLocationName] = useState(null);
  //const [editingMember, setEditingMember] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  //const [locationvalue, setLocationvalue] = useState(false);

  // pagination state
  const [pageInfo, setPageInfo] = useState(null);
  const [cursors, setCursors] = useState([null]); // cursors[0] === null
  const [pageIndex, setPageIndex] = useState(0);
  const [newContectRoleId, setNewContectRoleId] = useState(null);
  const PAGE_SIZE = 5;

  // helper to replace member in state by whichever id key exists
  function replaceMemberInState(updated) {
    setMembers((prev) =>
      prev.map((p) => {
        const keyP = p.roleAssignmentId ?? p.contactId ?? p.customerId ?? p.displayName;
        const keyU = updated.roleAssignmentId ?? updated.contactId ?? updated.customerId ?? updated.displayName;
        return keyP === keyU ? { ...p, ...updated } : p;
      })
    );
  }

  // fetchPage: single source of truth for loading any page by index
  const fetchPage = useCallback(async (index = 0) => {
    if (!locationId) {
      setMembers([]);
      setLocationName(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await shopify.sessionToken.get();

      //const after = cursors[index];
      let after = null;
      if (index === 0) {
        after = null;
      } else if (typeof cursors[index] !== "undefined" && cursors[index] !== null) {
        after = cursors[index];
      } else {
        // fallback to last-known cursor (the cursor that lets us fetch the next page)
        const lastKnown = cursors.length ? cursors[cursors.length - 1] : null;
        after = lastKnown ?? pageInfo?.endCursor ?? null;
      }

      const params = new URLSearchParams();
      params.set("locationId", locationId);
      params.set("first", String(PAGE_SIZE));
      if (after) params.set("after", after);

      const url = `${apiUrl}?${params.toString()}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        mode: "cors",
      });

      const json = await resp.json().catch(() => null);

      if (!resp.ok) {
        const msg = json?.message || `Failed to load members (${resp.status})`;
        setMembers([]);
        setLocationName(null);
        setPageInfo(null);
        setError(msg);
        return;
      }

      // case A: proxy already returned mapped members
      if (json?.success && Array.isArray(json.members)) {
        setMembers(json.members);


        //setMembers(json.members.sort((a, b) => (b.isYou === true) - (a.isYou === true)));
        setLocationName(json.location?.name ?? null);
        setPageInfo(json.pageInfo ?? null);

        // If we fetched the last-known cursor index, append the received endCursor (if any)
        if (index === cursors.length - 1 && json.pageInfo?.endCursor) {
          setCursors((prev) => [...prev, json.pageInfo.endCursor]);
        }
        setPageIndex(index);
      }
      else {
        setMembers([]);
        setLocationName(null);
        setPageInfo(null);
        setError(json?.message || `Failed to load members (${resp?.status ?? "unknown"})`);
      }
    } catch (err) {
      console.error("TeamMembersGrid fetch error:", err);
      setMembers([]);
      setLocationName(null);
      setPageInfo(null);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, locationId, cursors, pageInfo, PAGE_SIZE]);

  // initial load and refresh trigger
  useEffect(() => {
    // reset pagination when location changes
    setCursors([null]);
    setPageIndex(0);
    setPageInfo(null);
    setMembers([]);
    if (locationId) fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, refreshTrigger, newcontactid, newContectRoleId]);

  const goNext = () => {
    if (!pageInfo?.hasNextPage) return;
    fetchPage(pageIndex + 1);
  };

  const goPrev = () => {
    if (pageIndex <= 0) return;
    fetchPage(pageIndex - 1);
  };

  return (

    <s-stack gap="base">

      {loading && (
        <s-stack direction="inline" alignItems="center" gap='base'>
          <s-spinner accessibilityLabel="Loading members" />
          <s-text>Loading members…</s-text>
        </s-stack>
      )}

      {error && (
        <s-banner tone="critical">
          <s-text>{String(error)}</s-text>
        </s-banner>
      )}

      {!loading || !error || members.length === 0 && (
        <s-banner tone="info">
          <s-text>No team members for this location yet.</s-text>
        </s-banner>
      )}

      {/* {successMessage && (
        <s-banner tone="success" onClose={() => setSuccessMessage(null)}>
          <s-text>{successMessage}</s-text>
        </s-banner>
      )} */}
      {console.log("members total-",members.length)}
      {!loading && !error && members.length > 0 && (
        <>
          {/* Header row */}
          <s-box>
            <s-grid gridTemplateColumns='40% 30% 20% auto'>
              <s-grid-item> <s-text type="strong">Name</s-text> </s-grid-item>
              <s-grid-item> <s-text type="strong">Job title</s-text></s-grid-item>
              <s-grid-item> <s-text type="strong">Permissions</s-text></s-grid-item>
              <s-grid-item> <s-text type="strong">Edit</s-text></s-grid-item>
            </s-grid>
          </s-box>

          <s-divider />

          {/* Data rows */}
          {members.map((m) => {
            
            const currentUserIsLocationAdmin = members.some(
              (mm) => mm.isYou && (
                (mm.roleName || "").toLowerCase().includes("location admin") ||
                (Array.isArray(mm.permissions) &&
                  mm.permissions.join(" ").toLowerCase().includes("location admin"))
              )
            );
            
            setPingedvalue(currentUserIsLocationAdmin);

            const key = m.roleAssignmentId || m.contactId || m.customerId || m.displayName || Math.random();
            const name = m.displayName || m.legacyResourceId || "(No name)";
            const job = m.title || "-";
            const permsText = m.roleName || (Array.isArray(m.permissions) ? m.permissions.join(", ") : "-");
            const badgeProgress = permsText && permsText.toLowerCase().includes("admin")
              ? "success"
              : permsText && permsText.toLowerCase().includes("part")
                ? "caution"
                : "critical";

            return (
              <s-box key={key} >
              
                <s-grid gridTemplateColumns='40% 30% 20% auto' paddingBlockEnd="base">
                  <s-grid-item>{name}{m.isYou ? " (You)" : ""}</s-grid-item>

                  <s-grid-item>{job}</s-grid-item>

                  <s-grid-item>
                    {permsText.includes("Location admin") && (
                      <s-badge tone="neutral">
                        <s-stack direction='inline' >
                          <s-icon type='star' tone='auto' />
                          {permsText}
                        </s-stack>
                      </s-badge>
                    )}
                    {permsText.includes("Ordering only") && (
                      <s-stack direction='inline' >
                        <s-box><s-icon type="bag" /></s-box>
                        {permsText}
                      </s-stack>)}
                  </s-grid-item>

                  <s-box>
                      
                        {/* {currentUserIsLocationAdmin ? (
                        <>
                          <s-button command="--show" commandFor={`edit-member-${m.roleAssignmentId}`}><s-icon type="edit" /></s-button>
                          <s-modal id={`edit-member-${m.roleAssignmentId}`} heading="Manage Team Member">
                               <TeamMemberEditForm
                                member={m}
                                locationId={locationId}
                                apiUrl={editlocationmembers}
                                //onCancel={() => ui.overlay.close(`edit-member-${m.roleAssignmentId}`)}
                                onSaved={(updated) => {
                                  replaceMemberInState(updated);
                                  setSuccessMessage(`${updated.displayName ?? updated.firstName ?? "Member"} updated`);
                                  setNewContectRoleId(updated.roleAssignmentId)
                                  //ui.overlay.close(`edit-member-${m.roleAssignmentId}`);
                                }}
                              />
                          </s-modal>
                        </>
                        ) : (
                          null
                        )} */}
                        {permsText.includes("Location admin") && (
                          <>
                          <s-button command="--show" commandFor={`edit-member-${m.roleAssignmentId}`}>
                            <s-icon type="edit" />
                          </s-button>
                          <s-modal id={`edit-member-${m.roleAssignmentId}`} heading="Manage Team Member">
                               <TeamMemberEditForm
                                member={m}
                                locationId={locationId}
                                apiUrl={editlocationmembers}
                                //onCancel={() => ui.overlay.close(`edit-member-${m.roleAssignmentId}`)}
                                onSaved={(updated) => {
                                  replaceMemberInState(updated);
                                  setSuccessMessage(`${updated.displayName ?? updated.firstName ?? "Member"} updated`);
                                  setNewContectRoleId(updated.roleAssignmentId)
                                  //ui.overlay.close(`edit-member-${m.roleAssignmentId}`);
                                }}
                              />
                          </s-modal>
                        </>
                        )}
                    </s-box>
                </s-grid>
                
              <s-divider />
              </s-box>
            );
          })}
        </>
      )}

      {/* Pagination controls */}
       <s-stack direction="inline" alignItems="center" gap="base">
          <s-button onClick={goPrev} disabled={pageIndex <= 0 || loading}>Previous</s-button>
          <s-text>Page: {pageIndex + 1}</s-text>
          <s-button onClick={goNext} disabled={!pageInfo?.hasNextPage || loading}>Next</s-button>
        </s-stack>

    </s-stack>

  );
}
