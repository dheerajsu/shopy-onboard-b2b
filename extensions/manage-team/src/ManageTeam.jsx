import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from "preact/hooks";
import CreateLocation from "./components/CreateLocation.jsx";
import LocationDropdown from "./components/LocationDropdown.jsx";
import TeamMembersGrid from "./components/TeamMembersGrid.jsx";
import AddTeamMember from "./components/AddTeamMember.jsx";
import UpdateLocation from "./components/UpdateLocation.jsx"

import { BASE_URL } from "./config.js";

export default async () => {
  render(<ManageTeam />, document.body);
}

function ManageTeam() {
  const [locationName, setLocationName] = useState("");
  const inviteurl = `${BASE_URL}/apps/proxy/invite-team-member`;
  const companyLocation = `${BASE_URL}/apps/proxy/company-locations`;
  const locationmembers = `${BASE_URL}/apps/proxy/location-team-members`;

  //const  storage  = useStorage();
  const { storage } = shopify;

  const [InviteFirst, setInviteFirst] = useState(null);

  // Assign team member data start
  // locations + company
  const [companycreated, setCompanycreated] = useState(null);
  const [company, setCompany] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [loadingLocations, setLoadingLocations] = useState(true);

  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [newContactId, setNewContactId] = useState("");

  const [inviteTitle,setInviteTitle] = useState("");
  const [invitePermission,setInvitePermission] = useState("");
  const [showInvite,setShowInvite] = useState(false);
  // Assign team member data end

  // This will carry the last-created location object
  const [createdLocation, setCreatedLocation] = useState(null);

  const [pingedvalue, setPingedvalue] = useState(false);

  function handleCreated(loc) {
    setCreatedLocation(loc);
    // optionally still set selection locally so UI updates quickly
    setSelectedLocationId(loc.id);
    setSelectedLocation(loc);
    shopify.storage.write("selectedLocationId", loc.id);
    // clear after a short tick (so dropdown receives it, handles it once)
    setTimeout(() => setCreatedLocation(null), 500);
  }

  useEffect(() => {
    const fetchSelectedLocation = async () => {
      const value = await shopify.storage.read("selectedLocationId");
      // @ts-ignore
      setSelectedLocationId(value);
    };
    fetchSelectedLocation();
  }, [shopify.storage]);

  const handleSelectchange = async (id) => {
    await shopify.storage.write("selectedLocationId", id);
    setSelectedLocationId(id);
  }

  //----------------get location and company id
  useEffect(() => {
    //console.log("current pinged value",pingedvalue);
    let mounted = true;
    (async () => {
      setLoadingLocations(true);
      try {
        const token = await shopify.sessionToken.get();
        // use the same app-proxy route you gave LocationDropdown (absolute URL)
        const resp = await fetch(companyLocation, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
        });
        
        const json = await resp.json().catch(() => null);
        if (!mounted) return;
        //console.log("complete jsone",json);
        if (!json || !json.success) {
          setCompanycreated(true);
        }else{
          setCompanycreated(false);
        }

        if (!resp.ok) {
          console.warn("Failed to load company locations:", json);
          setCompany(null);
          setLocations([]);
          setSelectedLocationId(null);
        } else if (json?.success) {
          const nodes = json.locations ?? [];
          setCompany(json.company ?? null);
          setLocations(nodes);
          
          if (!selectedLocationId && nodes.length) {
            setSelectedLocationId(nodes[0].id);
            setSelectedLocation(nodes[0]);
          }
        } else {
          // unexpected payload
          setCompany(null);
          setLocations([]);
          setSelectedLocationId(null);
        }
      } catch (err) {
        console.error("Error loading company locations:", err);
        if (mounted) {
          setCompany(null);
          setLocations([]);
          setSelectedLocationId(null);
        }
      } finally {
        if (mounted) setLoadingLocations(false);
      }
    })();
    return () => { mounted = false; };
  }, [shopify.sessionToken, pingedvalue]);

  //console.log("current pinged value is--", pingedvalue);
  const managebuttons = (
    <s-popover id="manage-pop-company-id" >
      <s-stack gap='base'>
         <AddTeamMember
          inviteUrl={inviteurl}
          companyId={company?.id}
          companyLocationId={selectedLocationId}
          OnCreateMember={(updateid) => setNewContactId(updateid)}
        />
        <UpdateLocation
          // @ts-ignore
          locationmembers
          maincompanyLocationId={selectedLocationId}
          onLocationUpdated={(newName) => setLocationName(newName)}
        />
      </s-stack>
    </s-popover>
  );

   if (companycreated === true) {
    return (
      <s-page heading="Manage Team">
        <s-stack direction="block" gap="base">
          <s-banner tone="success">
            <s-text>Please Check your company status</s-text>
          </s-banner>
          <s-button variant="primary" href="extension:b2-b-registration/">
            Company Status
          </s-button>
        </s-stack>
      </s-page>
    );
  }else{
  return (
    <s-stack gap='large large' direction='block'>
      {inviteMessage && <s-banner tone="success"><s-text>{inviteMessage}</s-text></s-banner>}
      {inviteError && <s-banner tone="critical"><s-text>{inviteError}</s-text></s-banner>}

      <s-grid gridTemplateColumns="1fr auto">
        <s-heading>Manage Team</s-heading>
        {/* {pingedvalue && ( */}
          <CreateLocation onCreated={handleCreated} />
        {/* )} */}
      </s-grid>

      <s-section>
      
      <s-stack direction='block' gap='large large'>
          {/* <PopoverContentExample /> */}
        
        <s-grid gridTemplateColumns="1fr auto">
          <LocationDropdown
            companyId={company?.id}   // pass company GID if you have it, otherwise omit and server will resolve from session
            selectedId={selectedLocationId}
            newlocationName={locationName}
            onSelect={(id, node) => {
              setSelectedLocation(node);
              handleSelectchange(id)
            }}
            // pass createdLocation so dropdown can refetch and ensure the new one appears
            createdLocation={createdLocation}
          /> 

          {pingedvalue && (
            <s-button commandFor="manage-pop-company-id" variant="secondary">
              Manage <s-icon type="arrow-down" />
            </s-button>
          )}
          {managebuttons}
          </s-grid>
          <s-divider />
        

          {/* Invite form end */}

          <TeamMembersGrid
            apiUrl={locationmembers}
            locationId={selectedLocationId}
            newlocationName={locationName}
            setPingedvalue={setPingedvalue}
            newcontactid={newContactId}
            onEdit={(member) => {
              setInviteFirst(member.displayName?.split(" ")[0] ?? "");
              setInviteTitle(member.title ?? "");
              if (member.roleName) setInvitePermission(member.roleName);
              setShowInvite(true);
            }}
          />
        </s-stack>
      </s-section>
    </s-stack>
  );
}
}
