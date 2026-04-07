import React from "react";
import ResidentDashboardHeader from "../../components/ResidentDashboardHeader";
import AuthService from "../../services/AuthService";
import ViewManager from "../../services/ViewManager";

class StepPill extends React.Component {
  render() {
    const { label, active } = this.props;

    return (
      <div
        className={`text-[11px] px-3 py-1 rounded-full font-bold ${
          active ? "bg-blue-700 text-white" : "bg-gray-100 text-slate-600"
        }`}
      >
        {label}
      </div>
    );
  }
}

/**
 * SetupFamilyProfile - Dedicated setup page for family accounts
 * Captures household-level parameters beyond individual profile setup.
 */
class SetupFamilyProfile extends React.Component {
  STEPS = ["Family Setup", "Disabilities", "Documents", "Finish"];
  DISABILITIES = {
    visual: "Visual Disability",
    hearing: "Hearing Disability",
    intellectual: "Intellectual Disability",
    physical: "Physical Disability",
    psychological: "Psychological Disability",
    rare: "Rare Disability",
  };

  constructor(props) {
    super(props);

    this.state = {
      step: 0,
      isLoading: true,
      isSaving: false,
      error: "",
      successMessage: "",
      form: {
        householdName: "",
        householdHead: "",
        householdHeadDateOfBirth: "",
        householdHeadDisabilityType: "",
        householdHeadMedicalDocuments: [],
        contactNumber: "",
        address: "",
        totalMembers: "",
        pwdMembers: "",
        elderlyMembers: "",
        childMembers: "",
        pregnantMembers: "",
        mobilityNeedsCount: "",
        maintenanceMedicationCount: "",
        evacuationTransport: "",
        preferredEvacCenter: "",
        emergencyContactName: "",
        emergencyContactNumber: "",
        notes: "",
        householdMembers: [],
      },
    };

    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handlePrev = this.handlePrev.bind(this);
    this.handleHeadFilesChange = this.handleHeadFilesChange.bind(this);
    this.handleRemoveHeadFile = this.handleRemoveHeadFile.bind(this);
    this.handleMemberFilesChange = this.handleMemberFilesChange.bind(this);
    this.handleRemoveMemberFile = this.handleRemoveMemberFile.bind(this);
    this.handleMemberChange = this.handleMemberChange.bind(this);
    this.handleAddMember = this.handleAddMember.bind(this);
    this.handleRemoveMember = this.handleRemoveMember.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.loadExistingFamilyProfile = this.loadExistingFamilyProfile.bind(this);
  }

  componentDidMount() {
    this.loadExistingFamilyProfile();
  }

  async loadExistingFamilyProfile() {
    try {
      const user = AuthService.auth.currentUser;
      if (!user) {
        this.setState({ isLoading: false, error: "User not authenticated." });
        return;
      }

      const userData = await AuthService.getUserData(user.uid);

      // Ensure family accounts have a profile QR code
      if (!userData?.profileQrCode) {
        const generatedCode = `RR-${user.uid.slice(0, 10).toUpperCase()}`;
        await AuthService.updateUserProfile(user.uid, {
          profileQrCode: generatedCode,
        });
      }
      const familyProfile = userData?.familyProfile || {};
      const legacyMedicalDocuments = Array.isArray(
        familyProfile.uploadedMedicalDocuments,
      )
        ? familyProfile.uploadedMedicalDocuments
        : [];

      this.setState((prevState) => ({
        step: 0,
        isLoading: false,
        form: {
          ...prevState.form,
          householdName: familyProfile.householdName || "",
          householdHead:
            familyProfile.householdHead || userData?.fullName || "",
          householdHeadDateOfBirth:
            familyProfile.householdHeadDateOfBirth ||
            familyProfile.householdHeadDob ||
            "",
          householdHeadDisabilityType:
            familyProfile.householdHeadDisabilityType || "",
          householdHeadMedicalDocuments: Array.isArray(
            familyProfile.householdHeadMedicalDocuments,
          )
            ? familyProfile.householdHeadMedicalDocuments
            : legacyMedicalDocuments,
          contactNumber: familyProfile.contactNumber || userData?.phone || "",
          address: familyProfile.address || "",
          totalMembers:
            familyProfile.totalMembers != null
              ? String(familyProfile.totalMembers)
              : "",
          pwdMembers:
            familyProfile.pwdMembers != null
              ? String(familyProfile.pwdMembers)
              : "",
          elderlyMembers:
            familyProfile.elderlyMembers != null
              ? String(familyProfile.elderlyMembers)
              : "",
          childMembers:
            familyProfile.childMembers != null
              ? String(familyProfile.childMembers)
              : "",
          pregnantMembers:
            familyProfile.pregnantMembers != null
              ? String(familyProfile.pregnantMembers)
              : "",
          mobilityNeedsCount:
            familyProfile.mobilityNeedsCount != null
              ? String(familyProfile.mobilityNeedsCount)
              : "",
          maintenanceMedicationCount:
            familyProfile.maintenanceMedicationCount != null
              ? String(familyProfile.maintenanceMedicationCount)
              : "",
          evacuationTransport: familyProfile.evacuationTransport || "",
          preferredEvacCenter: familyProfile.preferredEvacCenter || "",
          emergencyContactName: familyProfile.emergencyContactName || "",
          emergencyContactNumber: familyProfile.emergencyContactNumber || "",
          notes: familyProfile.notes || "",
          householdMembers: Array.isArray(familyProfile.householdMembers)
            ? familyProfile.householdMembers.map((member) => {
                const memberDocuments = Array.isArray(member?.medicalDocuments)
                  ? member.medicalDocuments
                  : [];

                return {
                  name: member?.name || "",
                  dateOfBirth:
                    member?.dateOfBirth ||
                    member?.birthDate ||
                    member?.dob ||
                    "",
                  relationship: member?.relationship || "",
                  disabilityType: member?.disabilityType || "",
                  hasMobilityNeeds: Boolean(member?.hasMobilityNeeds),
                  hasMedicalNeeds: Boolean(member?.hasMedicalNeeds),
                  medicalDocuments: memberDocuments,
                };
              })
            : [],
        },
      }));
    } catch (error) {
      this.setState({
        isLoading: false,
        error: "Failed to load family profile data.",
      });
      console.error("Failed to load family profile:", error);
    }
  }

  handleInputChange(event) {
    const { name, value } = event.target;
    this.setState((prevState) => ({
      form: {
        ...prevState.form,
        [name]: value,
      },
      error: "",
      successMessage: "",
    }));
  }

  handleNext() {
    this.setState((prevState) => ({
      step: Math.min(this.STEPS.length - 1, prevState.step + 1),
      error: "",
      successMessage: "",
    }));
  }

  handlePrev() {
    this.setState((prevState) => ({
      step: Math.max(0, prevState.step - 1),
      error: "",
      successMessage: "",
    }));
  }

  handleHeadFilesChange(event) {
    const chosen = Array.from(event.target.files || []);
    if (chosen.length === 0) {
      return;
    }

    this.setState((prevState) => ({
      form: {
        ...prevState.form,
        householdHeadMedicalDocuments: [
          ...(prevState.form.householdHeadMedicalDocuments || []),
          ...chosen,
        ],
      },
      error: "",
      successMessage: "",
    }));

    event.target.value = "";
  }

  handleRemoveHeadFile(indexToRemove) {
    this.setState((prevState) => ({
      form: {
        ...prevState.form,
        householdHeadMedicalDocuments: (
          prevState.form.householdHeadMedicalDocuments || []
        ).filter((_, index) => index !== indexToRemove),
      },
      error: "",
      successMessage: "",
    }));
  }

  handleMemberFilesChange(index, event) {
    const chosen = Array.from(event.target.files || []);
    if (chosen.length === 0) {
      return;
    }

    this.setState((prevState) => {
      const members = [...prevState.form.householdMembers];
      const currentMember = members[index] || {
        name: "",
        dateOfBirth: "",
        relationship: "",
        disabilityType: "",
        hasMobilityNeeds: false,
        hasMedicalNeeds: false,
        medicalDocuments: [],
      };

      members[index] = {
        ...currentMember,
        medicalDocuments: [
          ...(currentMember.medicalDocuments || []),
          ...chosen,
        ],
      };

      return {
        form: {
          ...prevState.form,
          householdMembers: members,
        },
        error: "",
        successMessage: "",
      };
    });

    event.target.value = "";
  }

  handleRemoveMemberFile(memberIndex, fileIndex) {
    this.setState((prevState) => {
      const members = [...prevState.form.householdMembers];
      const currentMember = members[memberIndex];
      if (!currentMember) {
        return null;
      }

      members[memberIndex] = {
        ...currentMember,
        medicalDocuments: (currentMember.medicalDocuments || []).filter(
          (_, index) => index !== fileIndex,
        ),
      };

      return {
        form: {
          ...prevState.form,
          householdMembers: members,
        },
        error: "",
        successMessage: "",
      };
    });
  }

  handleMemberChange(index, fieldName, value) {
    this.setState((prevState) => {
      const members = [...prevState.form.householdMembers];
      const currentMember = members[index] || {
        name: "",
        dateOfBirth: "",
        relationship: "",
        disabilityType: "",
        hasMobilityNeeds: false,
        hasMedicalNeeds: false,
        medicalDocuments: [],
      };

      members[index] = {
        ...currentMember,
        [fieldName]: value,
      };

      return {
        form: {
          ...prevState.form,
          householdMembers: members,
        },
        error: "",
        successMessage: "",
      };
    });
  }

  handleAddMember() {
    this.setState((prevState) => ({
      form: {
        ...prevState.form,
        householdMembers: [
          ...prevState.form.householdMembers,
          {
            name: "",
            dateOfBirth: "",
            relationship: "",
            disabilityType: "",
            hasMobilityNeeds: false,
            hasMedicalNeeds: false,
            medicalDocuments: [],
          },
        ],
      },
      error: "",
      successMessage: "",
    }));
  }

  handleRemoveMember(index) {
    this.setState((prevState) => ({
      form: {
        ...prevState.form,
        householdMembers: prevState.form.householdMembers.filter(
          (_, memberIndex) => memberIndex !== index,
        ),
      },
      error: "",
      successMessage: "",
    }));
  }

  toNumberOrZero(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return Math.floor(parsed);
  }

  async handleSave(event) {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    const { form } = this.state;
    if (!form.householdName.trim() || !form.householdHead.trim()) {
      this.setState({
        error: "Household name and household head are required.",
      });
      return;
    }

    const cleanedMembers = form.householdMembers
      .map((member) => ({
        name: (member?.name || "").trim(),
        dateOfBirth: (member?.dateOfBirth || "").trim(),
        relationship: (member?.relationship || "").trim(),
        disabilityType: (member?.disabilityType || "").trim(),
        hasMobilityNeeds: Boolean(member?.hasMobilityNeeds),
        hasMedicalNeeds: Boolean(member?.hasMedicalNeeds),
        medicalDocuments: Array.isArray(member?.medicalDocuments)
          ? member.medicalDocuments.map((file) => ({
              name: file?.name || "unknown",
              size: file?.size || 0,
              type: file?.type || "application/octet-stream",
              lastModified: file?.lastModified || null,
            }))
          : [],
      }))
      .filter(
        (member) =>
          member.name ||
          member.relationship ||
          member.disabilityType ||
          member.dateOfBirth ||
          member.medicalDocuments.length > 0,
      );

    const safeHeadMedicalDocuments = Array.isArray(
      form.householdHeadMedicalDocuments,
    )
      ? form.householdHeadMedicalDocuments.map((file) => ({
          name: file?.name || "unknown",
          size: file?.size || 0,
          type: file?.type || "application/octet-stream",
          lastModified: file?.lastModified || null,
        }))
      : [];

    const user = AuthService.auth.currentUser;
    if (!user) {
      this.setState({ error: "User not authenticated." });
      return;
    }

    this.setState({ isSaving: true, error: "", successMessage: "" });

    try {
      const selectedDisabilities = Array.from(
        new Set(
          [
            form.householdHeadDisabilityType,
            ...cleanedMembers.map((member) => member.disabilityType),
          ].filter((item) => Boolean(item)),
        ),
      );
      const derivedDisabilities = selectedDisabilities.reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {});
      const flattenedMedicalDocuments = cleanedMembers.flatMap(
        (member) => member.medicalDocuments || [],
      );
      const allMedicalDocuments = [
        ...safeHeadMedicalDocuments,
        ...flattenedMedicalDocuments,
      ];

      const payload = {
        householdName: form.householdName.trim(),
        householdHead: form.householdHead.trim(),
        householdHeadDateOfBirth: (form.householdHeadDateOfBirth || "").trim(),
        householdHeadDisabilityType: form.householdHeadDisabilityType,
        householdHeadMedicalDocuments: safeHeadMedicalDocuments,
        contactNumber: form.contactNumber.trim(),
        address: form.address.trim(),
        totalMembers: Math.max(
          this.toNumberOrZero(form.totalMembers),
          cleanedMembers.length,
        ),
        pwdMembers: this.toNumberOrZero(form.pwdMembers),
        elderlyMembers: this.toNumberOrZero(form.elderlyMembers),
        childMembers: this.toNumberOrZero(form.childMembers),
        pregnantMembers: this.toNumberOrZero(form.pregnantMembers),
        mobilityNeedsCount: this.toNumberOrZero(form.mobilityNeedsCount),
        maintenanceMedicationCount: this.toNumberOrZero(
          form.maintenanceMedicationCount,
        ),
        evacuationTransport: form.evacuationTransport,
        preferredEvacCenter: form.preferredEvacCenter.trim(),
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactNumber: form.emergencyContactNumber.trim(),
        notes: form.notes.trim(),
        hasDisability: selectedDisabilities.length > 0,
        disabilities: derivedDisabilities,
        selectedDisabilities,
        disabilityNotes: "",
        uploadedMedicalDocuments: allMedicalDocuments,
        medicalDocumentCount: allMedicalDocuments.length,
        householdMembers: cleanedMembers,
        profileMode: "family",
        updatedAt: new Date(),
      };

      await AuthService.updateUserProfile(user.uid, {
        familyProfile: payload,
        profileCompleted: true,
        accountType: "residential-family",
      });

      this.setState({
        isSaving: false,
        successMessage: "Family profile saved successfully.",
        step: this.STEPS.length - 1,
      });
    } catch (error) {
      this.setState({
        isSaving: false,
        error: "Failed to save family profile.",
      });
      console.error("Failed to save family profile:", error);
    }
  }

  renderInput(label, name, type = "text", placeholder = "") {
    const value = this.state.form[name];
    return (
      <div>
        <label className='block text-xs font-bold text-gray-500 uppercase mb-1'>
          {label}
        </label>
        <input
          type={type}
          min={type === "number" ? "0" : undefined}
          name={name}
          value={value}
          onChange={this.handleInputChange}
          placeholder={placeholder}
          className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
        />
      </div>
    );
  }

  renderFamilySummaryPanel() {
    const { form, step } = this.state;
    const listedMembers = form.householdMembers.filter(
      (member) =>
        (member?.name || "").trim() ||
        (member?.relationship || "").trim() ||
        (member?.dateOfBirth || "").trim(),
    ).length;
    const declaredMembers = this.toNumberOrZero(form.totalMembers);
    const effectiveMembers = Math.max(declaredMembers, listedMembers);

    return (
      <div className='lg:col-span-3 bg-white border rounded p-4'>
        <h3 className='text-sm font-black text-slate-700 mb-3'>
          Family Snapshot
        </h3>

        <div className='mb-4'>
          <p className='text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2'>
            Current Step
          </p>
          <p className='text-sm font-black text-slate-800'>
            {this.STEPS[step]}
          </p>
        </div>

        <div className='space-y-2 text-xs'>
          <div className='flex items-center justify-between'>
            <span className='text-gray-500 font-semibold uppercase tracking-wide'>
              Household
            </span>
            <span className='font-bold text-slate-800 text-right ml-2'>
              {form.householdName || "—"}
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-gray-500 font-semibold uppercase tracking-wide'>
              Head
            </span>
            <span className='font-bold text-slate-800 text-right ml-2'>
              {form.householdHead || "—"}
            </span>
          </div>
        </div>

        <div className='mt-4 p-3 rounded border bg-blue-50'>
          <div className='text-xs font-bold text-blue-900 mb-2'>Population</div>
          <div className='space-y-1 text-xs'>
            <div className='flex items-center justify-between'>
              <span className='text-blue-800'>Total Members</span>
              <span className='font-black text-blue-900'>
                {effectiveMembers}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-blue-800'>Listed Rows</span>
              <span className='font-bold text-blue-900'>{listedMembers}</span>
            </div>
          </div>
        </div>

        <div className='mt-4 p-3 rounded border bg-gray-50'>
          <div className='text-xs font-bold text-slate-700 mb-2'>
            Vulnerable Counts
          </div>
          <div className='grid grid-cols-2 gap-2 text-xs'>
            <div className='flex items-center justify-between'>
              <span className='text-gray-600'>PWD</span>
              <span className='font-bold text-slate-800'>
                {this.toNumberOrZero(form.pwdMembers)}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-gray-600'>Elderly</span>
              <span className='font-bold text-slate-800'>
                {this.toNumberOrZero(form.elderlyMembers)}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-gray-600'>Children</span>
              <span className='font-bold text-slate-800'>
                {this.toNumberOrZero(form.childMembers)}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-gray-600'>Pregnant</span>
              <span className='font-bold text-slate-800'>
                {this.toNumberOrZero(form.pregnantMembers)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  getSelectedDisabilitiesCount() {
    const memberDisabilities = (this.state.form?.householdMembers || [])
      .map((member) => member?.disabilityType || "")
      .filter((item) => Boolean(item));

    return new Set(memberDisabilities).size;
  }

  renderFamilySetupStep() {
    const { form } = this.state;

    return (
      <div className='space-y-6'>
        <div className='space-y-3'>
          <div className='text-xs font-bold text-slate-700 uppercase tracking-wide'>
            Household Details
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {this.renderInput("Household Name", "householdName")}
            {this.renderInput("Household Head", "householdHead")}
            {this.renderInput(
              "Household Head Date of Birth",
              "householdHeadDateOfBirth",
              "date",
            )}
            {this.renderInput("Contact Number", "contactNumber")}
            {this.renderInput("Address", "address")}
            {this.renderInput("Total Members", "totalMembers", "number")}
            {this.renderInput("PWD Members", "pwdMembers", "number")}
            {this.renderInput("Elderly Members", "elderlyMembers", "number")}
            {this.renderInput("Child Members", "childMembers", "number")}
            {this.renderInput("Pregnant Members", "pregnantMembers", "number")}
            {this.renderInput(
              "Mobility Needs Count",
              "mobilityNeedsCount",
              "number",
            )}
            {this.renderInput(
              "Medication Dependents",
              "maintenanceMedicationCount",
              "number",
            )}

            <div>
              <label className='block text-xs font-bold text-gray-500 uppercase mb-1'>
                Evacuation Transport
              </label>
              <select
                name='evacuationTransport'
                value={form.evacuationTransport}
                onChange={this.handleInputChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              >
                <option value=''>Select transport support</option>
                <option value='none'>No special transport</option>
                <option value='wheelchair-van'>Wheelchair Van</option>
                <option value='ambulance'>Ambulance</option>
                <option value='barangay-vehicle'>Barangay Vehicle</option>
              </select>
            </div>

            {this.renderInput("Preferred Evac Center", "preferredEvacCenter")}
            {this.renderInput("Emergency Contact Name", "emergencyContactName")}
            {this.renderInput(
              "Emergency Contact Number",
              "emergencyContactNumber",
            )}
          </div>
        </div>

        <div className='pt-2 border-t space-y-3'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs font-bold uppercase tracking-wide text-slate-500'>
                Household Members
              </p>
              <p className='text-xs text-slate-500'>
                Add and edit household member records.
              </p>
            </div>
            <button
              type='button'
              onClick={this.handleAddMember}
              className='px-3 py-1.5 rounded border border-blue-300 text-blue-700 text-xs font-bold hover:bg-blue-50'
            >
              + Add Member
            </button>
          </div>

          {form.householdMembers.length === 0 ? (
            <div className='text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2'>
              No members added yet.
            </div>
          ) : (
            <div className='space-y-3'>
              {form.householdMembers.map((member, index) => (
                <div
                  key={`member-${index}`}
                  className='border border-gray-200 rounded p-3 bg-gray-50 space-y-3'
                >
                  <div className='flex items-center justify-between'>
                    <p className='text-xs font-bold uppercase text-slate-500'>
                      Member {index + 1}
                    </p>
                    <button
                      type='button'
                      onClick={() => this.handleRemoveMember(index)}
                      className='px-2 py-1 rounded border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50'
                    >
                      Remove
                    </button>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                    <input
                      type='text'
                      value={member.name}
                      onChange={(event) =>
                        this.handleMemberChange(
                          index,
                          "name",
                          event.target.value,
                        )
                      }
                      placeholder='Full name'
                      className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                    <input
                      type='date'
                      value={member.dateOfBirth || ""}
                      onChange={(event) =>
                        this.handleMemberChange(
                          index,
                          "dateOfBirth",
                          event.target.value,
                        )
                      }
                      className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                    <input
                      type='text'
                      value={member.relationship}
                      onChange={(event) =>
                        this.handleMemberChange(
                          index,
                          "relationship",
                          event.target.value,
                        )
                      }
                      placeholder='Relationship'
                      className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                  </div>

                  <div className='flex flex-wrap items-center gap-4'>
                    <label className='inline-flex items-center gap-2 text-xs text-slate-700 font-semibold'>
                      <input
                        type='checkbox'
                        checked={member.hasMobilityNeeds}
                        onChange={(event) =>
                          this.handleMemberChange(
                            index,
                            "hasMobilityNeeds",
                            event.target.checked,
                          )
                        }
                        className='h-4 w-4'
                      />
                      Mobility needs
                    </label>
                    <label className='inline-flex items-center gap-2 text-xs text-slate-700 font-semibold'>
                      <input
                        type='checkbox'
                        checked={member.hasMedicalNeeds}
                        onChange={(event) =>
                          this.handleMemberChange(
                            index,
                            "hasMedicalNeeds",
                            event.target.checked,
                          )
                        }
                        className='h-4 w-4'
                      />
                      Medical needs
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='pt-2 border-t'>
          <label className='block text-xs font-bold text-gray-500 uppercase mb-1'>
            Family Notes
          </label>
          <textarea
            name='notes'
            value={form.notes}
            onChange={this.handleInputChange}
            rows={4}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-slate-900 placeholder:text-slate-500 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Special care, evacuation instructions, or household remarks'
          />
        </div>
      </div>
    );
  }

  renderDisabilitiesStep() {
    const { form } = this.state;
    const listedMembers = form.householdMembers || [];

    return (
      <div>
        <div className='mb-4'>
          <h3 className='text-sm font-black text-slate-700'>
            Member Disability Information
          </h3>
          <p className='text-xs text-gray-400'>
            Select disability type per household member.
          </p>
        </div>

        <div className='border border-gray-200 rounded p-3 bg-gray-50 mb-4'>
          <div className='flex items-center justify-between gap-3'>
            <p className='text-xs font-bold uppercase text-slate-500'>
              Household Head
            </p>
            <span className='text-xs text-slate-500'>
              {form.householdHead || "No head name set"}
            </span>
          </div>
          <div className='mt-2'>
            <label className='block text-xs font-bold text-gray-500 uppercase mb-1'>
              Disability Type
            </label>
            <select
              name='householdHeadDisabilityType'
              value={form.householdHeadDisabilityType}
              onChange={this.handleInputChange}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value=''>None</option>
              {Object.keys(this.DISABILITIES).map((key) => (
                <option key={key} value={key}>
                  {this.DISABILITIES[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {listedMembers.length === 0 ? (
          <div className='text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded p-4'>
            Add members in the Family Setup step first.
          </div>
        ) : (
          <div className='space-y-3'>
            {listedMembers.map((member, index) => (
              <div
                key={`disability-member-${index}`}
                className='border border-gray-200 rounded p-3 bg-gray-50'
              >
                <div className='flex items-center justify-between gap-3'>
                  <p className='text-xs font-bold uppercase text-slate-500'>
                    {member?.name || `Member ${index + 1}`}
                  </p>
                  <span className='text-xs text-slate-500'>
                    {member?.relationship || "No relationship set"}
                  </span>
                </div>
                <div className='mt-2'>
                  <label className='block text-xs font-bold text-gray-500 uppercase mb-1'>
                    Disability Type
                  </label>
                  <select
                    value={member?.disabilityType || ""}
                    onChange={(event) =>
                      this.handleMemberChange(
                        index,
                        "disabilityType",
                        event.target.value,
                      )
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  >
                    <option value=''>None</option>
                    {Object.keys(this.DISABILITIES).map((key) => (
                      <option key={key} value={key}>
                        {this.DISABILITIES[key]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  renderDocumentsStep() {
    const { form } = this.state;
    const listedMembers = form.householdMembers || [];
    const headDocuments = Array.isArray(form.householdHeadMedicalDocuments)
      ? form.householdHeadMedicalDocuments
      : [];

    return (
      <div>
        <div className='mb-4'>
          <h3 className='text-sm font-black text-slate-700'>
            Upload Medical Documents
          </h3>
          <p className='text-xs text-gray-400'>
            Upload medical certificates for the household head and each member.
          </p>
        </div>

        <div className='space-y-4'>
          <div className='border border-gray-200 rounded p-4 bg-gray-50'>
            <div className='flex items-center justify-between gap-3 mb-3'>
              <p className='text-xs font-bold uppercase text-slate-500'>
                Household Head
              </p>
              <span className='text-xs text-slate-500'>
                {form.householdHead || "No head name set"}
              </span>
            </div>

            <div className='border-2 border-dashed border-gray-300 rounded p-4 text-center mb-3 bg-white'>
              <div className='text-sm font-bold text-slate-700 mb-1'>
                Upload documents for household head
              </div>
              <div className='text-xs text-gray-400'>
                PDF, JPG, PNG (Max 10MB each)
              </div>
              <input
                type='file'
                multiple
                onChange={this.handleHeadFilesChange}
                className='hidden'
                id='family-head-medical-file-upload'
                accept='.pdf,.jpg,.jpeg,.png'
              />
              <button
                type='button'
                onClick={() =>
                  document
                    .getElementById("family-head-medical-file-upload")
                    .click()
                }
                className='mt-3 px-4 py-2 bg-blue-700 text-white rounded font-bold text-xs'
              >
                Choose Files
              </button>
            </div>

            {headDocuments.length > 0 && (
              <div>
                <div className='text-xs font-bold text-gray-600 mb-2'>
                  Uploaded Files ({headDocuments.length})
                </div>
                <div className='space-y-2'>
                  {headDocuments.map((file, fileIndex) => (
                    <div
                      key={`${file?.name || "file"}-${fileIndex}`}
                      className='flex items-center justify-between bg-white p-3 rounded border'
                    >
                      <div className='text-xs text-gray-700 font-bold'>
                        {file?.name || `Document ${fileIndex + 1}`}
                      </div>
                      <button
                        type='button'
                        onClick={() => this.handleRemoveHeadFile(fileIndex)}
                        className='text-xs text-red-600 hover:text-red-700 font-bold'
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {listedMembers.length === 0 ? (
            <div className='text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded p-4'>
              Add household members in Family Setup if you need separate uploads
              for each member.
            </div>
          ) : (
            listedMembers.map((member, memberIndex) => {
              const memberName = (member?.name || "").trim();
              const files = Array.isArray(member?.medicalDocuments)
                ? member.medicalDocuments
                : [];
              const fileInputId = `family-medical-file-upload-${memberIndex}`;

              return (
                <div
                  key={`member-documents-${memberIndex}`}
                  className='border border-gray-200 rounded p-4 bg-gray-50'
                >
                  <div className='flex items-center justify-between gap-3 mb-3'>
                    <p className='text-xs font-bold uppercase text-slate-500'>
                      {memberName || `Member ${memberIndex + 1}`}
                    </p>
                    <span className='text-xs text-slate-500'>
                      {member?.relationship || "No relationship set"}
                    </span>
                  </div>

                  <div className='border-2 border-dashed border-gray-300 rounded p-4 text-center mb-3 bg-white'>
                    <div className='text-sm font-bold text-slate-700 mb-1'>
                      Upload documents for this member
                    </div>
                    <div className='text-xs text-gray-400'>
                      PDF, JPG, PNG (Max 10MB each)
                    </div>
                    <input
                      type='file'
                      multiple
                      onChange={(event) =>
                        this.handleMemberFilesChange(memberIndex, event)
                      }
                      className='hidden'
                      id={fileInputId}
                      accept='.pdf,.jpg,.jpeg,.png'
                    />
                    <button
                      type='button'
                      onClick={() =>
                        document.getElementById(fileInputId).click()
                      }
                      className='mt-3 px-4 py-2 bg-blue-700 text-white rounded font-bold text-xs'
                    >
                      Choose Files
                    </button>
                  </div>

                  {files.length > 0 && (
                    <div>
                      <div className='text-xs font-bold text-gray-600 mb-2'>
                        Uploaded Files ({files.length})
                      </div>
                      <div className='space-y-2'>
                        {files.map((file, fileIndex) => (
                          <div
                            key={`${file?.name || "file"}-${fileIndex}`}
                            className='flex items-center justify-between bg-white p-3 rounded border'
                          >
                            <div className='text-xs text-gray-700 font-bold'>
                              {file?.name || `Document ${fileIndex + 1}`}
                            </div>
                            <button
                              type='button'
                              onClick={() =>
                                this.handleRemoveMemberFile(
                                  memberIndex,
                                  fileIndex,
                                )
                              }
                              className='text-xs text-red-600 hover:text-red-700 font-bold'
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  renderFinishStep() {
    const { form } = this.state;
    const totalHeadDocuments = Array.isArray(form.householdHeadMedicalDocuments)
      ? form.householdHeadMedicalDocuments.length
      : 0;
    const totalMemberDocuments = (form.householdMembers || []).reduce(
      (total, member) =>
        total +
        (Array.isArray(member?.medicalDocuments)
          ? member.medicalDocuments.length
          : 0),
      0,
    );
    const totalMedicalDocuments = totalHeadDocuments + totalMemberDocuments;

    return (
      <div>
        <div className='mb-4'>
          <h3 className='text-sm font-black text-slate-700'>Review & Finish</h3>
          <p className='text-xs text-gray-400'>
            Review family information before saving.
          </p>
        </div>

        <div className='space-y-4'>
          <div className='bg-blue-50 border border-blue-100 rounded p-4 text-xs'>
            <p className='font-bold text-blue-900 mb-2'>Family Setup</p>
            <p>
              <span className='text-gray-600'>Household:</span>{" "}
              <span className='font-bold text-black'>
                {form.householdName || "—"}
              </span>
            </p>
            <p>
              <span className='text-gray-600'>Head:</span>{" "}
              <span className='font-bold text-black'>
                {form.householdHead || "—"}
              </span>
            </p>
            <p>
              <span className='text-gray-600'>Members:</span>{" "}
              <span className='font-bold text-black'>
                {form.totalMembers || form.householdMembers.length || 0}
              </span>
            </p>
          </div>

          <div className='bg-green-50 border border-green-100 rounded p-4 text-xs'>
            <p className='font-bold text-green-900 mb-2'>Disabilities</p>
            <p className='text-gray-700'>
              {this.getSelectedDisabilitiesCount() > 0
                ? `${this.getSelectedDisabilitiesCount()} type(s) selected across members`
                : "No disabilities selected for members"}
            </p>
          </div>

          <div className='bg-purple-50 border border-purple-100 rounded p-4 text-xs'>
            <p className='font-bold text-purple-900 mb-2'>Medical Documents</p>
            <p className='text-gray-700'>
              {totalMedicalDocuments} file
              {totalMedicalDocuments !== 1 ? "s" : ""} attached
            </p>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { step, isLoading, isSaving, error, successMessage, form } =
      this.state;

    return (
      <div className='min-h-screen bg-[#f3f4f6]'>
        <ResidentDashboardHeader
          userName={form.householdName || "Family Account"}
          activeTab=''
          profileMenuActiveItem='setup-profile'
          onViewProfile={() => ViewManager.goToViewProfile()}
          onOpenSetup={() => ViewManager.goToFamilySetupProfile()}
          onLogout={this.props.onLogout}
          onTabChange={(tabKey) => {
            if (typeof this.props.onNavigateTab === "function") {
              this.props.onNavigateTab(tabKey);
            }
          }}
        />

        <div className='p-6'>
          <div className='max-w-6xl mx-auto'>
            <div className='bg-white rounded shadow-sm overflow-hidden'>
              <div className='px-6 py-4 border-b'>
                <div className='flex items-start justify-between gap-6 mb-4'>
                  <div className='flex-1 min-w-0'>
                    <h1 className='text-2xl font-black text-[#3a4a5b]'>
                      Setup Your Family Profile
                    </h1>
                    <p className='text-xs text-gray-500 mt-1'>
                      Welcome back — complete your profile steps.
                    </p>
                  </div>
                  <div className='hidden md:flex md:items-center md:gap-4 shrink-0'>
                    <div>
                      <div className='text-sm font-black'>
                        {form.householdName || "Family Account"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-2 mb-4'>
                  {this.STEPS.map((item, index) => (
                    <StepPill key={item} label={item} active={step === index} />
                  ))}
                </div>

                <div className='mt-4 p-3 rounded border bg-blue-50'>
                  <div className='text-xs font-bold text-blue-900 mb-2'>
                    Progress
                  </div>
                  <div className='w-full bg-white rounded h-2 overflow-hidden'>
                    <div className='flex h-2 gap-2 px-1'>
                      {this.STEPS.map((item, index) => (
                        <div
                          key={item}
                          className={`flex-1 rounded ${
                            index <= step ? "bg-blue-600" : "bg-blue-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className='text-xs text-blue-800 mt-2 font-bold'>
                    {step + 1} of {this.STEPS.length}
                  </div>

                  {error && (
                    <div className='mt-3 p-3 bg-red-50 border border-red-200 rounded'>
                      <div className='text-xs text-red-700 font-bold'>
                        • {error}
                      </div>
                    </div>
                  )}

                  {successMessage && (
                    <div className='mt-3 p-3 bg-green-50 border border-green-200 rounded'>
                      <div className='text-xs text-green-700 font-bold'>
                        {successMessage}
                      </div>
                    </div>
                  )}

                  <div className='mt-3 flex justify-end gap-2'>
                    {step > 0 && (
                      <button
                        type='button'
                        onClick={this.handlePrev}
                        disabled={isSaving || isLoading}
                        className='px-3 py-2 bg-slate-100 border border-slate-200 rounded font-bold text-sm text-slate-800 hover:bg-slate-200 disabled:opacity-50'
                      >
                        Previous
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={
                        step === this.STEPS.length - 1
                          ? this.handleSave
                          : this.handleNext
                      }
                      disabled={isSaving || isLoading}
                      className='px-3 py-2 bg-blue-700 text-white rounded font-bold text-sm hover:bg-blue-800 disabled:opacity-50'
                    >
                      {isSaving
                        ? "Saving..."
                        : step === this.STEPS.length - 1
                          ? "Finish"
                          : "Next"}
                    </button>
                  </div>
                </div>
              </div>

              <div className='p-6 grid grid-cols-1 lg:grid-cols-12 gap-6'>
                {this.renderFamilySummaryPanel()}

                <div className='bg-white border rounded p-6 lg:col-span-9'>
                  {isLoading ? (
                    <div className='text-sm text-gray-500'>
                      Loading family profile...
                    </div>
                  ) : (
                    <div>
                      {step === 0 && this.renderFamilySetupStep()}
                      {step === 1 && this.renderDisabilitiesStep()}
                      {step === 2 && this.renderDocumentsStep()}
                      {step === 3 && this.renderFinishStep()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default SetupFamilyProfile;
