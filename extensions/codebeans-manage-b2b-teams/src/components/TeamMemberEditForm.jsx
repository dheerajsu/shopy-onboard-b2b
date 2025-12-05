import React, { useEffect, useState } from "preact/hooks";
import '@shopify/ui-extensions/preact';
import { render } from 'preact';

/**
 * TeamMemberEditForm
 * Props:
 *  - member: the member object to edit (may be null)
 *  - apiUrl: proxy URL to call to save changes
 *  - locationId
 *  - onSaved: (updatedMember) => void
 */
export default function TeamMemberEditForm({ member, locationId, apiUrl, onSaved = () => { } }) {

  // local editable state
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [permission, setPermission] = useState(""); // "Location admin" | "Ordering only"
  const [isMainContact, setIsMainContact] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newcontactId, setNewcontactId] = useState(null);

  // initialize when member changes
  useEffect(() => {
    if (!member) return;
    // prefer explicit first/last fields if present, otherwise try splitting displayName
    if (member.firstName || member.lastName) {
      setName(member.firstName ?? member.displayName ?? "");
      setLastName(member.lastName ?? "");
    } else if (member.displayName) {
      const parts = member.displayName.split(" ");
      setName(parts.shift() ?? "");
      setLastName(parts.join(" "));
    } else {
      setName("");
      setLastName("");
    }

    setTitle(member.title ?? "");
    // derive permission from roleName or permissions
    const permsText = (member.roleName || (Array.isArray(member.permissions) ? member.permissions.join(", ") : "")).toLowerCase();
    if (permsText.includes("location admin")) setPermission("Location admin");
    else if (permsText.includes("ordering only")) setPermission("Ordering only");
    else setPermission(member.roleName ?? "");
    setIsMainContact(Boolean(member.isMainContact));
    setError(null);
  }, [member]);

  if (!member) return null;

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setLoading(true);

    try {
      const token = await shopify.sessionToken.get();
      // Prepare payload - adapt to your proxy's expected shape
      const payload = {
        action: "updateMember",
        roleAssignmentId: newcontactId ?? member.roleAssignmentId ?? null,
        contactId: member.contactId ?? null,
        customerId: member.customerId ?? null,
        firstName: name,
        lastName,
        displayName: [name, lastName].filter(Boolean).join(" "),
        title,
        roleName: permission,
        isMainContact,
        locationid: locationId
      };


      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        mode: "cors",
      });

      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(json?.message || `Save failed (${resp.status})`);
      }
      setNewcontactId(json.newassignLocationId);
      // The proxy should return the updated member; if not, we produce an updated object locally
      const updatedMember = json?.member ?? {
        ...member,
        roleAssignmentId: json.newassignLocationId ?? null,
        firstName: payload.firstName,
        lastName: payload.lastName,
        displayName: payload.displayName,
        title,
        roleName: permission,
        isMainContact,
      };
      //ui.overlay.close('my-modal');
      setTimeout(() => {
        try {
          // @ts-ignore
          onSaved(updatedMember);
        } catch (e) {
          console.error("onSaved threw:", e);
        }
      }, 100); // small delay

      //onSaved(updatedMember);
    } catch (err) {
      console.error("save member error:", err);
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <s-stack>

        {error && (
          <s-banner tone="critical">
            <s-text>{String(error)}</s-text>
          </s-banner>
        )}
        {success && (
          <s-banner tone="success">
            <s-text>{success}</s-text>
          </s-banner>
        )}
        <s-stack gap="base">

          <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base">
            <s-grid-item gridColumn="span 6" gridRow="span 1">
              <s-text-field label="First Name" value={name} disabled={loading}
                onChange={(v) => {
                  const val = /** @type {HTMLInputElement} */ (v.target).value;
                  setName(val);
                }}
              />
            </s-grid-item>
            <s-grid-item gridColumn="span 6" gridRow="span 1">
              <s-text-field label="Last name" value={lastName} disabled={loading}
                onChange={(v) => {
                  const val = /** @type {HTMLInputElement} */ (v.target).value;
                  setLastName(val);
                }}
              />
            </s-grid-item>


            <s-grid-item gridColumn="span 12" gridRow="span 1">
              <s-text-field label="Job title" value={title} disabled={loading}
                onChange={(v) => {
                  const val = /** @type {HTMLInputElement} */ (v.target).value;
                  setTitle(val);
                }}
              />
            </s-grid-item>
            <s-grid-item gridColumn="span 12" gridRow="span 1">
              <s-select label="Permission" value={permission}
                onChange={(v) => {
                  const val = /** @type {HTMLInputElement} */ (v.target).value;
                  setPermission(val);
                }} disabled={loading}
              >
                <s-option value="Location admin">Location admin</s-option>
                <s-option value="Ordering only">Ordering only</s-option>
              </s-select>
            </s-grid-item>

            <s-grid-item gridColumn="span 4" gridRow="span 1">
              <s-button variant="primary" onClick={handleSave} loading={loading} disabled={loading}>
                {loading ?
                  <s-stack direction="inline" gap="base">
                    <s-spinner />
                    <s-text>Saving…</s-text>
                  </s-stack> : "Save"}
              </s-button>
            </s-grid-item>
          </s-grid>
        </s-stack>

        {/* <s-stack gap="base" alignContent="center">
          <s-button variant="primary" onClick={handleSave} loading={loading} disabled={loading}>
            {loading ?
              <s-stack direction="inline" gap="base">
                <s-spinner />
                <s-text>Saving…</s-text>
              </s-stack> : "Save"}
          </s-button>
        </s-stack> */}

      </s-stack>
    </>
  );
}
