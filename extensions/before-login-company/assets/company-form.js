// Company Form with fixed same-as-shipping functionality
class CompanyForm {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = options;
    
    // Your app's development URL
    this.endpointBaseUrl = "https://shopy-onboard-b2b.onrender.com";
    
    // State for same as shipping address
    this.sameAsShipping = false;
    
    if (this.container) {
      this.init();
    } else {
      console.error('Container not found:', containerId);
    }
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <form class="company-form" id="company-form-${this.options.blockId}">
        <!-- Customer Information Section -->
        <div class="form-section">
          <h2 class="section-title">Customer Information</h2>
          <div class="section-description">
            Please provide your personal information
          </div>
          <div class="form-grid">
            ${this.renderField('customer_first_name', 'First Name', 'text', true)}
            ${this.renderField('customer_last_name', 'Last Name', 'text', true)}
            ${this.renderField('customer_email', 'Email', 'email', true)}
            ${this.renderField('customer_phone', 'Phone Number', 'tel', true)}
          </div>
        </div>

        <!-- Company Information Section -->
        <div class="form-section">
          <h2 class="section-title">Company Information</h2>
          <div class="section-description">
            Please provide your company details
          </div>
          <div class="form-grid">
            ${this.renderField('company_name', 'Company Name', 'text', true)}
            ${this.renderField('external_id', 'External ID', 'text', false)}
            ${this.renderField('tax_id', 'Tax ID', 'text', false)}
          </div>
        </div>

        <!-- Shipping Address Section -->
        <div class="form-section">
          <h2 class="section-title">Shipping Address</h2>
          <div class="section-description">
            Where should we ship your orders?
          </div>
          <div class="form-grid">
            ${this.renderField('shipping_department', 'Department', 'text', false)}
            ${this.renderField('shipping_first_name', 'First Name', 'text', true)}
            ${this.renderField('shipping_last_name', 'Last Name', 'text', true)}
            ${this.renderField('shipping_phone', 'Phone Number', 'tel', true)}
            ${this.renderField('shipping_address1', 'Address Line 1', 'text', true, 'form-group--full')}
            ${this.renderField('shipping_address2', 'Address Line 2', 'text', false, 'form-group--full')}
            
            <!-- Shopify Country and Province Selectors -->
            <div class="form-group form-group--full">
              <label for="shipping_country-${this.options.blockId}" class="form-label">
                Country <span class="required">*</span>
              </label>
              <select
                id="shipping_country-${this.options.blockId}"
                name="shipping_country"
                class="form-select"
                required
                data-country-select="true"
                data-address-type="shipping"
              >
                <option value="">Loading countries...</option>
              </select>
            </div>

            <div class="form-group form-group--full">
              <label for="shipping_province-${this.options.blockId}" class="form-label">
                Province/State <span class="required">*</span>
              </label>
              <select
                id="shipping_province-${this.options.blockId}"
                name="shipping_province"
                class="form-select"
                required
                data-province-select="true"
                data-address-type="shipping"
              >
                <option value="">Select province/state</option>
              </select>
            </div>

            ${this.renderField('shipping_city', 'City', 'text', true)}
            ${this.renderField('shipping_zip', 'Postal/Zip Code', 'text', true)}
          </div>
        </div>

        <!-- Same as Shipping Address Checkbox -->
        <div class="form-section">
          <div class="form-checkbox-group">
            <input type="checkbox" id="same-as-shipping-${this.options.blockId}" class="form-checkbox">
            <label for="same-as-shipping-${this.options.blockId}" class="form-checkbox-label">
              Same As Shipping Address
            </label>
          </div>
        </div>

        <!-- Billing Address Section -->
        <div class="form-section billing-address-section" id="billing-address-${this.options.blockId}">
          <h2 class="section-title">Billing Address</h2>
          <div class="section-description">
            Where should we send invoices?
          </div>
          <div class="form-grid">
            ${this.renderField('billing_department', 'Department', 'text', false)}
            ${this.renderField('billing_first_name', 'First Name', 'text', true)}
            ${this.renderField('billing_last_name', 'Last Name', 'text', true)}
            ${this.renderField('billing_phone', 'Phone Number', 'tel', true)}
            ${this.renderField('billing_address1', 'Address Line 1', 'text', true, 'form-group--full')}
            ${this.renderField('billing_address2', 'Address Line 2', 'text', false, 'form-group--full')}
            
            <!-- Shopify Country and Province Selectors -->
            <div class="form-group form-group--full">
              <label for="billing_country-${this.options.blockId}" class="form-label">
                Country <span class="required">*</span>
              </label>
              <select
                id="billing_country-${this.options.blockId}"
                name="billing_country"
                class="form-select"
                required
                data-country-select="true"
                data-address-type="billing"
              >
                <option value="">Loading countries...</option>
              </select>
            </div>

            <div class="form-group form-group--full">
              <label for="billing_province-${this.options.blockId}" class="form-label">
                Province/State <span class="required">*</span>
              </label>
              <select
                id="billing_province-${this.options.blockId}"
                name="billing_province"
                class="form-select"
                required
                data-province-select="true"
                data-address-type="billing"
              >
                <option value="">Select province/state</option>
              </select>
            </div>

            ${this.renderField('billing_city', 'City', 'text', true)}
            ${this.renderField('billing_zip', 'Postal/Zip Code', 'text', true)}
          </div>
        </div>

        <!-- Form Actions -->
        <div class="form-section">
          <div class="form-actions">
            <button type="submit" class="btn btn--primary btn--full" id="submit-btn-${this.options.blockId}">
              Submit Registration
            </button>
          </div>
        </div>
      </form>
      
      <!-- Success Message -->
      <div id="success-${this.options.blockId}" class="form-success" style="display: none;">
        <div class="form-success__content">
          <div class="form-success__icon">✓</div>
          <h3>Registration Successful!</h3>
          <p>Thank you! Your company registration has been submitted successfully.</p>
          <button type="button" class="btn btn--secondary" onclick="location.reload()">
            Submit Another Registration
          </button>
        </div>
      </div>
    `;

    // Load countries after rendering
    this.loadCountries();
  }

  renderField(name, label, type = 'text', required = false, additionalClass = '') {
    const classNames = `form-group ${additionalClass}`;
    return `
      <div class="${classNames}">
        <label for="${name}-${this.options.blockId}" class="form-label">
          ${label} ${required ? '<span class="required">*</span>' : ''}
        </label>
        <input
          type="${type}"
          id="${name}-${this.options.blockId}"
          name="${name}"
          class="form-input"
          ${required ? 'required' : ''}
        />
      </div>
    `;
  }

  async loadAllCountriesFromAsset() {
    if (this._countriesCache) return this._countriesCache;

    // Use the injected URL if present, otherwise fallback to an asset path
    const url = (typeof window !== 'undefined' && window.COUNTRIES_URL) ? window.COUNTRIES_URL : '/assets/countries.json';

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch countries.json: ' + res.status);
      const json = await res.json();
      // Expecting { "countries": [ ... ] } or an array directly
      this._countriesCache = Array.isArray(json.countries) ? json.countries : (Array.isArray(json) ? json : []);
      return this._countriesCache;
    } catch (err) {
      console.error('Could not load countries.json from', url, err);
      this._countriesCache = [];
      return this._countriesCache;
    }
  }

  // -------------------------------
  // Helper: find country by code or name (case-insensitive)
  // -------------------------------
  findCountryByCode(codeOrName) {
    if (!codeOrName || !this._countriesCache) return null;
    const key = String(codeOrName).trim().toUpperCase();
    return this._countriesCache.find(c => {
      if (!c) return false;
      if (c.code && String(c.code).toUpperCase() === key) return true;
      if (c.iso_code && String(c.iso_code).toUpperCase() === key) return true;
      if (c.name && String(c.name).toUpperCase() === key) return true;
      return false;
    }) || null;
  }

  // -------------------------------
  // Replace loadCountries() — populate your country <select>s from the single countries.json asset
  // -------------------------------
  async loadCountries() {
    // Ensure we loaded the asset once
    await this.loadAllCountriesFromAsset();

    const countrySelects = this.container.querySelectorAll('[data-country-select="true"]');
    countrySelects.forEach(select => {
      // Preserve current selected value if present
      const currentValue = select.value || '';
      select.innerHTML = '<option value="">Select Country</option>';
      this._countriesCache.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code || country.iso_code || country.name;
        option.textContent = country.name;
        select.appendChild(option);
      });
      // restore previously-selected if still present
      if (currentValue) select.value = currentValue;
    });
  }

  async loadProvinces(countryCode, provinceSelect) {
    if (!provinceSelect) return;

    // If no country code provided, reset to placeholder
    if (!countryCode) {
      // If select, show placeholder option; if input, keep as input
      if (provinceSelect.tagName === 'SELECT') {
        provinceSelect.innerHTML = '<option value="">Select province/state</option>';
      } else {
        provinceSelect.value = '';
      }
      return;
    }

    // Ensure countries list loaded
    await this.loadAllCountriesFromAsset();

    const country = this.findCountryByCode(countryCode);

    // If country not found or no provinces -> convert to free-text input
    if (!country || !Array.isArray(country.provinces) || country.provinces.length === 0) {
      // Replace select with input if necessary
      if (provinceSelect.tagName === 'SELECT') {
        // create input to replace select
        const input = document.createElement('input');
        input.type = 'text';
        input.id = provinceSelect.id;
        input.name = provinceSelect.name;
        input.className = provinceSelect.className;
        input.placeholder = 'State / Province (free text)';
        input.setAttribute('data-province-select', 'true');
        const addr = provinceSelect.getAttribute('data-address-type');
        if (addr) input.setAttribute('data-address-type', addr);
        provinceSelect.parentNode.replaceChild(input, provinceSelect);
        return input;
      } else {
        // it's already an input — clear placeholder
        provinceSelect.value = '';
        return provinceSelect;
      }
    }

    // Country has provinces: ensure we have a SELECT
    let sel = provinceSelect;
    if (sel.tagName !== 'SELECT') {
      // create select and replace input
      const newSelect = document.createElement('select');
      newSelect.id = sel.id;
      newSelect.name = sel.name;
      newSelect.className = sel.className;
      newSelect.setAttribute('data-province-select', 'true');
      const addr = sel.getAttribute('data-address-type');
      if (addr) newSelect.setAttribute('data-address-type', addr);
      sel.parentNode.replaceChild(newSelect, sel);
      sel = newSelect;
    }

    // Populate select options
    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select province/state';
    sel.appendChild(placeholder);

    country.provinces.forEach(p => {
      const option = document.createElement('option');
      option.value = p.code || p.name || '';
      option.textContent = p.name || p.code || '';
      sel.appendChild(option);
    });

    return sel;
  }

  bindEvents() {
    const form = this.container.querySelector('form');
    const submitBtn = this.container.querySelector(`#submit-btn-${this.options.blockId}`);
    const sameAsShippingCheckbox = this.container.querySelector(`#same-as-shipping-${this.options.blockId}`);
    
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit(form, submitBtn);
      });
    }

    // Same as shipping address functionality
    if (sameAsShippingCheckbox) {
      sameAsShippingCheckbox.addEventListener('change', (e) => {
        this.handleSameAsShipping(e.target.checked);
      });
    }

    // Country change events for province dropdowns
    const countrySelects = this.container.querySelectorAll('[data-country-select="true"]');
    countrySelects.forEach(select => {
      select.addEventListener('change', (e) => {
        const countryCode = e.target.value;
        const addressType = e.target.getAttribute('data-address-type');
        const provinceSelect = this.container.querySelector(`[data-province-select="true"][data-address-type="${addressType}"]`);
        
        if (provinceSelect) {
          this.loadProvinces(countryCode, provinceSelect);
        }
      });
    });
  }

  handleSameAsShipping(checked) {
    this.sameAsShipping = checked;
    const billingSection = this.container.querySelector(`#billing-address-${this.options.blockId}`);
    
    if (checked) {
      // Copy shipping address to billing address
      this.copyShippingToBilling();
      billingSection.style.display = 'none'; // HIDE the billing section
      this.removeBillingFieldRequirements(); // Remove required attributes
    } else {
      billingSection.style.display = 'block'; // SHOW the billing section
      this.addBillingFieldRequirements(); // Add back required attributes
    }
  }

  removeBillingFieldRequirements() {
    const billingFields = this.container.querySelectorAll('[id^="billing_"]');
    billingFields.forEach(field => {
      field.removeAttribute('required');
    });
  }

  addBillingFieldRequirements() {
    const billingFields = this.container.querySelectorAll('[id^="billing_"]');
    const requiredFields = [
      'billing_first_name', 'billing_last_name', 'billing_phone', 
      'billing_address1', 'billing_country', 'billing_province', 
      'billing_city', 'billing_zip'
    ];
    
    billingFields.forEach(field => {
      const fieldName = field.getAttribute('name');
      if (requiredFields.includes(fieldName)) {
        field.setAttribute('required', 'required');
      }
    });
  }

  async copyShippingToBilling() {
    const fields = [
      'department', 'first_name', 'last_name', 'phone',
      'address1', 'address2', 'country', 'province', 'city', 'zip'
    ];

    for (const field of fields) {
      const shippingField = this.container.querySelector(`#shipping_${field}-${this.options.blockId}`) ||
                            this.container.querySelector(`[name="shipping_${field}"]`) ||
                            this.container.querySelector(`[data-shipping-${field}]`);
      const billingField  = this.container.querySelector(`#billing_${field}-${this.options.blockId}`) ||
                            this.container.querySelector(`[name="billing_${field}"]`) ||
                            this.container.querySelector(`[data-billing-${field}]`);

      if (!shippingField || !billingField) continue;

      // If country: copy value and ensure billing provinces are loaded for that country
      if (field === 'country') {
        billingField.value = shippingField.value;

        // find billing province element and ensure provinces for copied country are loaded
        const billingProvince = this.container.querySelector(`#billing_province-${this.options.blockId}`) ||
                                this.container.querySelector('[data-province-select="true"][data-address-type="billing"]');

        if (billingProvince) {
          await this.loadProvinces(shippingField.value, billingProvince);
        }

        continue;
      }

      // If province: copy after provinces are loaded
      if (field === 'province') {
        const shippingProv = this.container.querySelector(`#shipping_province-${this.options.blockId}`) ||
                             this.container.querySelector('[data-province-select="true"][data-address-type="shipping"]');
        const billingProv  = this.container.querySelector(`#billing_province-${this.options.blockId}`) ||
                             this.container.querySelector('[data-province-select="true"][data-address-type="billing"]');

        if (shippingProv && billingProv) {
          billingProv.value = shippingProv.value || shippingProv.textContent || '';
        }
        continue;
      }

      // default copy
      if (shippingField.tagName === 'SELECT' && billingField.tagName === 'SELECT') {
        billingField.value = shippingField.value;
      } else {
        billingField.value = shippingField.value;
      }
    }
  }

  async handleSubmit(form, submitBtn) {
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Submitting...';
    
    try {
      // Get form data
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      console.log("all data is",data);
      
      // Add metadata
      data.timestamp = new Date().toISOString();
      data.shop_domain = window.location.hostname;
      data.block_id = this.options.blockId;
      data.same_as_shipping = this.sameAsShipping;

      console.log('Submitting data:', data);
      
      // If same as shipping is checked, ensure billing fields are populated from shipping
      if (this.sameAsShipping) {
        this.ensureBillingDataFromShipping(data);
      }

      // Construct the full URL
      const finalEndpoint = `${this.endpointBaseUrl}/${this.options.apiEndpoint}`;
      console.log("Final endpoint:", finalEndpoint);
      
      const response = await fetch(finalEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      console.log('Response status:', response.status);
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('Success response:', result);
        this.showSuccess(result.submissionId);
      } else {
        // Handle specific error cases
        if (response.status === 409 && result.error.includes('already registered')) {
          throw new Error('This email address is already registered. Please use a different email address or contact support.');
        } else if (result.error && result.missingFields) {
          // Highlight missing fields
          this.highlightMissingFields(result.missingFields);
          throw new Error('Please fill in all required fields marked in red.');
        } else if (result.error.includes('valid email')) {
          this.highlightField('customer_email');
          throw new Error('Please enter a valid email address.');
        } else {
          throw new Error(result.error || `There was an error submitting your form. Please try again.`);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
      this.showError(error.message);
      
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit Registration';
    }
  }

  ensureBillingDataFromShipping(data) {
    // Map shipping data to billing data when same as shipping is checked
    const fieldMapping = {
      'shipping_department': 'billing_department',
      'shipping_first_name': 'billing_first_name',
      'shipping_last_name': 'billing_last_name',
      'shipping_phone': 'billing_phone',
      'shipping_address1': 'billing_address1',
      'shipping_address2': 'billing_address2',
      'shipping_country': 'billing_country',
      'shipping_province': 'billing_province',
      'shipping_city': 'billing_city',
      'shipping_zip': 'billing_zip'
    };

    Object.keys(fieldMapping).forEach(shippingKey => {
      const billingKey = fieldMapping[shippingKey];
      if (data[shippingKey] && !data[billingKey]) {
        data[billingKey] = data[shippingKey];
      }
    });
  }

  highlightMissingFields(missingFields) {
    // Remove existing error highlights
    this.container.querySelectorAll('.form-input--error').forEach(field => {
      field.classList.remove('form-input--error');
    });
    
    // Highlight missing fields
    missingFields.forEach(fieldName => {
      const field = this.container.querySelector(`[name="${fieldName}"]`);
      if (field) {
        field.classList.add('form-input--error');
      }
    });
  }

  highlightField(fieldName) {
    const field = this.container.querySelector(`[name="${fieldName}"]`);
    if (field) {
      field.classList.add('form-input--error');
      field.focus();
    }
  }

  showError(message) {
    // Remove existing error
    const existingError = this.container.querySelector('.form-error');
    if (existingError) {
      existingError.remove();
    }
    
    // Create error element
    const errorEl = document.createElement('div');
    errorEl.className = 'form-error';
    errorEl.innerHTML = `
      <div class="form-error__content">
        <strong>Registration Error:</strong> ${message}
      </div>
    `;
    
    const form = this.container.querySelector('form');
    if (form) {
      form.prepend(errorEl);
      
      // Scroll to error message
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Remove error after 8 seconds and clear field highlights
    setTimeout(() => {
      if (errorEl && errorEl.parentNode) {
        errorEl.remove();
      }
      // Clear field highlights after a longer period
      setTimeout(() => {
        this.container.querySelectorAll('.form-input--error').forEach(field => {
          field.classList.remove('form-input--error');
        });
      }, 500);
    }, 8000);
  }

  showSuccess(submissionId) {
    const form = this.container.querySelector('form');
    const successDiv = this.container.querySelector(`#success-${this.options.blockId}`);
    
    if (form && successDiv) {
      form.style.display = 'none';
      successDiv.style.display = 'block';
      
      if (submissionId) {
        const message = successDiv.querySelector('p');
        message.innerHTML += ` Your reference ID: <strong>${submissionId}</strong>`;
      }
      
      // Scroll to success message
      successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// Global initialization
window.initializeCompanyForm = function(containerId, options = {}) {
  return new CompanyForm(containerId, options);
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', function() {
  const formContainers = document.querySelectorAll('[id^="shopy-company-form-"]');
  formContainers.forEach(container => {
    const blockId = container.id.replace('shopy-company-form-', '');
    window.initializeCompanyForm(container.id, {
      blockId: blockId,
      apiEndpoint: 'api/company-submissions'
    });
  });
});