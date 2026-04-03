import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { clientsAPI } from '../services/api';
import PageHeader from '../components/layout/PageHeader';
import ConnectedAccounts from '../components/ui/ConnectedAccounts';
import CompetitorSection from '../components/ui/CompetitorSection';
import { useOAuthStatus } from '../hooks/useData';
import {
  ArrowRight, Building2, CheckCircle2, Globe2, ImagePlus, Loader2,
  MapPin, MessageCircle, Palette, Phone, PlugZap, Upload, Users, X,
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const CYAN = '#00d7ff';
const CYAN_SOFT = 'rgba(31, 182, 207, 0.16)';

const BUSINESS_CATEGORIES = [
  'Electronics', 'Retail', 'Services', 'Food & Beverage', 'Healthcare',
  'Education', 'Real Estate', 'Automotive', 'Hospitality', 'Manufacturing',
  'Technology', 'Fashion', 'Sports & Recreation', 'Beauty & Wellness',
  'Home & Garden', 'Professional Services', 'Entertainment', 'Transportation',
  'Agriculture', 'Financial Services', 'Legal Services', 'Construction',
  'Media & Communications', 'Non-Profit', 'Government', 'Other'
];

const BRAND_TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'funny', label: 'Funny' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'friendly', label: 'Friendly' },
];

const SOCIAL_PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google_my_business', label: 'Google My Business' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Other' },
];

const GENDERS = [
  { value: 'all', label: 'All' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'unspecified', label: 'Unspecified' },
];

export default function ClientOnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const clientId = user?.client_id;
  const { status: oauthStatus } = useOAuthStatus(clientId);

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [formData, setFormData] = useState({
    // Business Basics
    name: user?.first_name + ' ' + user?.last_name || '',
    company: '',
    email: user?.email || '',
    phone: '',
    whatsapp_number: '',
    website: '',
    gmb_url: '',

    // Brand Profile
    business_category: '',
    business_subcategories: [],
    brand_description: '',
    usp: '',
    brand_tone: '',
    target_audience: '',
    gender: 'all',
    business_location: '',
    target_locations: [],

    // Assets
    profile_image: null,
    product_images: [],
    brand_assets: {},

    // Competitors
    competitors: [],
  });

  const competitorLinksArrayToObject = (links) => {
    return (links || []).reduce((acc, link) => {
      if (link.platform && link.url) {
        acc[link.platform] = link.url;
      }
      return acc;
    }, {});
  };

  const addCompetitorLink = (index) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.map((comp, i) =>
        i === index ? {
          ...comp,
          social_links: [
            ...(comp.social_links || []),
            { platform: 'facebook', url: '' }
          ]
        } : comp
      )
    }));
  };

  const updateCompetitorLink = (index, linkIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.map((comp, i) =>
        i === index ? {
          ...comp,
          social_links: (comp.social_links || []).map((link, li) =>
            li === linkIndex ? { ...link, [field]: value } : link
          )
        } : comp
      )
    }));
  };

  const removeCompetitorLink = (index, linkIndex) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.map((comp, i) =>
        i === index ? {
          ...comp,
          social_links: (comp.social_links || []).filter((_, li) => li !== linkIndex)
        } : comp
      )
    }));
  };

  const steps = [
    { id: 'business', title: 'Business Basics', description: 'Tell us about your company', icon: Building2, eyebrow: 'Foundation' },
    { id: 'brand', title: 'Brand Profile', description: 'Define your brand identity', icon: Palette, eyebrow: 'Voice' },
    { id: 'audience', title: 'Target Audience', description: 'Who is your ideal customer?', icon: Users, eyebrow: 'People' },
    { id: 'assets', title: 'Brand Assets', description: 'Upload your visual assets', icon: ImagePlus, eyebrow: 'Visuals' },
    { id: 'competitors', title: 'Competitors', description: 'Who are your main competitors?', icon: Globe2, eyebrow: 'Market' },
    { id: 'connect', title: 'Connect Accounts', description: 'Link your social media accounts', icon: PlugZap, eyebrow: 'Launch' },
  ];
  const currentStepData = steps[currentStep];
  const progressPct = Math.round(((currentStep + 1) / steps.length) * 100);
  const connectedAccountsCount = Object.values(oauthStatus || {}).filter(
    (item) => item?.status === 'active'
  ).length;

  const handleInputChange = (field, value) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubcategoryToggle = (subcategory) => {
    setErrors((prev) => {
      if (!prev.business_subcategories) return prev;
      const next = { ...prev };
      delete next.business_subcategories;
      return next;
    });
    setFormData(prev => ({
      ...prev,
      business_subcategories: prev.business_subcategories.includes(subcategory)
        ? prev.business_subcategories.filter(s => s !== subcategory)
        : [...prev.business_subcategories, subcategory]
    }));
  };

  const handleLocationToggle = (location) => {
    setErrors((prev) => {
      if (!prev.target_locations) return prev;
      const next = { ...prev };
      delete next.target_locations;
      return next;
    });
    setFormData(prev => ({
      ...prev,
      target_locations: prev.target_locations.includes(location)
        ? prev.target_locations.filter(l => l !== location)
        : [...prev.target_locations, location]
    }));
  };

  const handleFileUpload = (field, files) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (field === 'product_images') {
      setFormData(prev => ({
        ...prev,
        product_images: [...prev.product_images, ...Array.from(files)]
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: files[0] }));
    }
  };

  const removeFile = (field, index) => {
    if (field === 'product_images') {
      setFormData(prev => ({
        ...prev,
        product_images: prev.product_images.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: null }));
    }
  };

  const addCompetitor = () => {
    setFormData(prev => ({
      ...prev,
      competitors: [...prev.competitors, { name: '', social_links: [{ platform: 'facebook', url: '' }] }]
    }));
  };

  const updateCompetitor = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.map((comp, i) =>
        i === index ? { ...comp, [field]: value } : comp
      )
    }));
  };

  const removeCompetitor = (index) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.filter((_, i) => i !== index)
    }));
  };

  const isValidUrl = (value) => {
    if (!value) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const getFieldError = (field) => errors[field];

  const focusStep = (stepIndex) => {
    setCurrentStep(stepIndex);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const validateStep = (stepIndex) => {
    const nextErrors = {};

    if (stepIndex === 0) {
      if (!formData.company.trim()) nextErrors.company = 'Business name is required.';
      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = 'Enter a valid email address.';
      if (!isValidUrl(formData.website)) nextErrors.website = 'Use a full website URL like https://example.com';
      if (!isValidUrl(formData.gmb_url)) nextErrors.gmb_url = 'Use a valid Google Business profile URL.';
    }

    if (stepIndex === 1) {
      if (!formData.business_category) nextErrors.business_category = 'Choose the category that best matches your business.';
      if (!formData.brand_description.trim()) nextErrors.brand_description = 'Add a short brand description.';
      if (!formData.usp.trim()) nextErrors.usp = 'Tell us what makes your business stand out.';
    }

    if (stepIndex === 2) {
      if (!formData.target_audience.trim()) nextErrors.target_audience = 'Describe the audience you want to reach.';
      if (!formData.business_location.trim()) nextErrors.business_location = 'Add your primary business location.';
      if (!formData.target_locations.length) nextErrors.target_locations = 'Select at least one target location.';
    }

    if (stepIndex === 3) {
      if (formData.profile_image && !(formData.profile_image instanceof File)) {
        nextErrors.profile_image = 'Please choose a valid image file.';
      }
      if ((formData.product_images || []).some((file) => !(file instanceof File))) {
        nextErrors.product_images = 'One or more product images are invalid.';
      }
    }

    if (stepIndex === 5 && connectedAccountsCount < 1) {
      nextErrors.social_connection = 'Connect at least one social media account before completing setup.';
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      focusStep(currentStep);
      return;
    }
    setSubmitError('');
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    let firstInvalidStep = -1;
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      if (!validateStep(stepIndex)) {
        firstInvalidStep = stepIndex;
        break;
      }
    }

    if (firstInvalidStep !== -1) {
      setSubmitError('Please fix the highlighted fields before finishing setup.');
      focusStep(firstInvalidStep);
      return;
    }

    setLoading(true);
    setSubmitError('');
    try {
      const submitData = new FormData();

      const normalizedData = {
        ...formData,
        competitors: formData.competitors.map(comp => ({
          name: comp.name,
          social_links: competitorLinksArrayToObject(comp.social_links)
        })),
      };

      // Add all form fields
      Object.keys(normalizedData).forEach(key => {
        if (normalizedData[key] === null || normalizedData[key] === undefined) {
          return;
        }
        if (key === 'profile_image' && normalizedData[key] instanceof File) {
          submitData.append(key, normalizedData[key]);
        } else if (key === 'product_images') {
          submitData.append(key, JSON.stringify([]));
        } else if (Array.isArray(normalizedData[key]) || typeof normalizedData[key] === 'object') {
          submitData.append(key, JSON.stringify(normalizedData[key]));
        } else {
          submitData.append(key, normalizedData[key]);
        }
      });

      submitData.append('onboarding_complete', 'true');

      if (clientId) {
        await clientsAPI.update(clientId, submitData);
      } else {
        await clientsAPI.create(submitData);
        await refreshUser();
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Onboarding submission failed:', error);
      setSubmitError(
        error.response?.data?.profile_image?.[0]
        || error.response?.data?.detail
        || 'We could not save your onboarding details. Please review the highlighted sections and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Business Basics
        return (
          <div style={styles.stepContent}>
            <div style={styles.stepIntro}>
              <span style={styles.stepEyebrow}>Profile Setup</span>
              <h2 style={styles.stepHeading}>Give your workspace a strong starting point</h2>
              <p style={styles.stepSummary}>We’ll use these details across reporting, automations, and AI-generated content suggestions.</p>
            </div>

            <div style={styles.featureRow}>
              <div style={styles.featureCard}>
                <Building2 size={16} />
                <div>
                  <div style={styles.featureTitle}>Business identity</div>
                  <div style={styles.featureText}>Make your dashboard feel tailored from the first sync.</div>
                </div>
              </div>
              <div style={styles.featureCard}>
                <MessageCircle size={16} />
                <div>
                  <div style={styles.featureTitle}>Contact ready</div>
                  <div style={styles.featureText}>Keep the basics available for captions, campaigns, and team handoff.</div>
                </div>
              </div>
            </div>

            <div style={styles.panelGrid}>
              <div style={styles.formPanel}>
                <div style={styles.panelTitle}>Who you are</div>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Your Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      style={styles.input}
                      placeholder="Enter your full name"
                    />
                    {getFieldError('name') && <div style={styles.errorTooltip}>{getFieldError('name')}</div>}
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Business Name <span style={styles.requiredAsterisk}>*</span></label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      style={styles.input}
                      placeholder="Your company name"
                      required
                    />
                    {getFieldError('company') && <div style={styles.errorTooltip}>{getFieldError('company')}</div>}
                  </div>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    style={styles.input}
                    placeholder="business@email.com"
                  />
                  {getFieldError('email') && <div style={styles.errorTooltip}>{getFieldError('email')}</div>}
                </div>
              </div>

              <div style={styles.formPanelAlt}>
                <div style={styles.panelTitle}>Where people can reach you</div>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      style={styles.input}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>WhatsApp Number</label>
                    <input
                      type="tel"
                      value={formData.whatsapp_number}
                      onChange={(e) => handleInputChange('whatsapp_number', e.target.value)}
                      style={styles.input}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      style={styles.input}
                      placeholder="https://yourwebsite.com"
                    />
                    {getFieldError('website') && <div style={styles.errorTooltip}>{getFieldError('website')}</div>}
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Google My Business URL</label>
                    <input
                      type="url"
                      value={formData.gmb_url}
                      onChange={(e) => handleInputChange('gmb_url', e.target.value)}
                      style={styles.input}
                      placeholder="https://g.page/your-business"
                    />
                    {getFieldError('gmb_url') && <div style={styles.errorTooltip}>{getFieldError('gmb_url')}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 1: // Brand Profile
        return (
          <div style={styles.stepContent}>
            <div style={styles.stepIntro}>
              <span style={styles.stepEyebrow}>Brand System</span>
              <h2 style={styles.stepHeading}>Shape the tone people should feel</h2>
              <p style={styles.stepSummary}>These details guide the writing style, positioning, and creative direction across the platform.</p>
            </div>

            <div style={styles.panelGrid}>
              <div style={styles.formPanel}>
                <div style={styles.panelTitle}>Category & voice</div>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Business Category <span style={styles.requiredAsterisk}>*</span></label>
                    <select
                      value={formData.business_category}
                      onChange={(e) => handleInputChange('business_category', e.target.value)}
                      style={styles.select}
                    >
                      <option value="">Select a category</option>
                      {BUSINESS_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    {getFieldError('business_category') && <div style={styles.errorTooltip}>{getFieldError('business_category')}</div>}
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Brand Tone</label>
                    <div style={styles.choiceGrid}>
                      {BRAND_TONES.map(tone => {
                        const active = formData.brand_tone === tone.value;
                        return (
                          <button
                            key={tone.value}
                            type="button"
                            onClick={() => handleInputChange('brand_tone', tone.value)}
                            style={{ ...styles.choiceCard, ...(active ? styles.choiceCardActive : {}) }}
                          >
                            <span style={styles.choiceTitle}>{tone.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {formData.business_category && getSubcategoriesForCategory(formData.business_category).length > 0 && (
                  <div style={styles.field}>
                    <label style={styles.label}>Subcategories</label>
                    <div style={styles.checkboxGrid}>
                      {getSubcategoriesForCategory(formData.business_category).map(sub => (
                        <label
                          key={sub}
                          style={{
                            ...styles.checkboxPill,
                            ...(formData.business_subcategories.includes(sub) ? styles.checkboxPillActive : {}),
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={formData.business_subcategories.includes(sub)}
                            onChange={() => handleSubcategoryToggle(sub)}
                            style={styles.checkbox}
                          />
                          {sub}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.formPanelAlt}>
                <div style={styles.panelTitle}>Brand story</div>
                <div style={styles.field}>
                  <label style={styles.label}>Brand Description <span style={styles.requiredAsterisk}>*</span></label>
                  <textarea
                    value={formData.brand_description}
                    onChange={(e) => handleInputChange('brand_description', e.target.value)}
                    style={styles.textarea}
                    placeholder="Describe your brand in a few sentences..."
                    rows={4}
                  />
                  {getFieldError('brand_description') && <div style={styles.errorTooltip}>{getFieldError('brand_description')}</div>}
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Unique Selling Points (USP) <span style={styles.requiredAsterisk}>*</span></label>
                  <textarea
                    value={formData.usp}
                    onChange={(e) => handleInputChange('usp', e.target.value)}
                    style={styles.textarea}
                    placeholder="What makes your business unique?"
                    rows={4}
                  />
                  {getFieldError('usp') && <div style={styles.errorTooltip}>{getFieldError('usp')}</div>}
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Target Audience
        return (
          <div style={styles.stepContent}>
            <div style={styles.stepIntro}>
              <span style={styles.stepEyebrow}>Audience Map</span>
              <h2 style={styles.stepHeading}>Define who you want to attract</h2>
              <p style={styles.stepSummary}>A little audience clarity helps the platform recommend better campaigns, content themes, and targeting ideas.</p>
            </div>

            <div style={styles.panelGrid}>
              <div style={styles.formPanel}>
                <div style={styles.panelTitle}>Customer snapshot</div>
                <div style={styles.field}>
                  <label style={styles.label}>Target Audience Description <span style={styles.requiredAsterisk}>*</span></label>
                  <textarea
                    value={formData.target_audience}
                    onChange={(e) => handleInputChange('target_audience', e.target.value)}
                    style={styles.textarea}
                    placeholder="Describe your ideal customers..."
                    rows={5}
                  />
                  {getFieldError('target_audience') && <div style={styles.errorTooltip}>{getFieldError('target_audience')}</div>}
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Primary Gender</label>
                  <div style={styles.choiceGrid}>
                    {GENDERS.map(gender => {
                      const active = formData.gender === gender.value;
                      return (
                        <button
                          key={gender.value}
                          type="button"
                          onClick={() => handleInputChange('gender', gender.value)}
                          style={{ ...styles.choiceCard, ...(active ? styles.choiceCardActive : {}) }}
                        >
                          <span style={styles.choiceTitle}>{gender.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={styles.formPanelAlt}>
                <div style={styles.panelTitle}>Where they are</div>
                <div style={styles.field}>
                  <label style={styles.label}>Business Location <span style={styles.requiredAsterisk}>*</span></label>
                  <input
                    type="text"
                    value={formData.business_location}
                    onChange={(e) => handleInputChange('business_location', e.target.value)}
                    style={styles.input}
                    placeholder="City, State/Country"
                  />
                  {getFieldError('business_location') && <div style={styles.errorTooltip}>{getFieldError('business_location')}</div>}
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Target Locations <span style={styles.requiredAsterisk}>*</span></label>
                  <div style={styles.checkboxGrid}>
                    {['Local (Same City)', 'Regional (Same State/Province)', 'National', 'International'].map(loc => (
                      <label
                        key={loc}
                        style={{
                          ...styles.checkboxPill,
                          ...(formData.target_locations.includes(loc) ? styles.checkboxPillActive : {}),
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.target_locations.includes(loc)}
                          onChange={() => handleLocationToggle(loc)}
                          style={styles.checkbox}
                        />
                        {loc}
                      </label>
                    ))}
                  </div>
                  {getFieldError('target_locations') && <div style={styles.errorTooltip}>{getFieldError('target_locations')}</div>}
                </div>
              </div>
            </div>
          </div>
        );

      case 3: // Brand Assets
        return (
          <div style={styles.stepContent}>
            <div style={styles.stepIntro}>
              <span style={styles.stepEyebrow}>Visual Identity</span>
              <h2 style={styles.stepHeading}>Bring your brand to life visually</h2>
              <p style={styles.stepSummary}>Upload a few assets now so your workspace, reports, and generated content feel unmistakably yours.</p>
            </div>

            <div style={styles.panelGrid}>
              <div style={styles.assetCard}>
                <div style={styles.assetCardTitle}>Profile Image</div>
                <div style={styles.assetCardText}>Use your logo or a strong brand mark.</div>
                <div style={styles.fileUpload}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('profile_image', e.target.files)}
                    style={styles.fileInput}
                    id="profile-image"
                  />
                  <label htmlFor="profile-image" style={styles.fileLabel}>
                    <Upload size={16} />
                    Choose Profile Image
                  </label>
                  {getFieldError('profile_image') && <div style={styles.errorTooltip}>{getFieldError('profile_image')}</div>}
                  {formData.profile_image && (
                    <div style={styles.singlePreviewCard}>
                      <div style={styles.filePreview}>
                        <img src={URL.createObjectURL(formData.profile_image)} alt="Profile" style={styles.previewImgLarge} />
                        <button onClick={() => removeFile('profile_image')} style={styles.removeBtn}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.assetCardAlt}>
                <div style={styles.assetCardTitle}>Product Images</div>
                <div style={styles.assetCardText}>Add up to 5 images to train future creative work.</div>
                <div style={styles.fileUpload}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileUpload('product_images', e.target.files)}
                    style={styles.fileInput}
                    id="product-images"
                  />
                  <label htmlFor="product-images" style={styles.fileLabel}>
                    <Upload size={16} />
                    Choose Product Images
                  </label>
                  {getFieldError('product_images') && <div style={styles.errorTooltip}>{getFieldError('product_images')}</div>}
                  <div style={styles.imageGrid}>
                    {formData.product_images.map((file, index) => (
                      <div key={index} style={styles.filePreview}>
                        <img src={URL.createObjectURL(file)} alt={`Product ${index + 1}`} style={styles.previewImgLarge} />
                        <button onClick={() => removeFile('product_images', index)} style={styles.removeBtn}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 4: // Competitors
        return (
          <div style={styles.stepContent}>
            <CompetitorSection
              competitors={formData.competitors}
              socialPlatforms={SOCIAL_PLATFORMS}
              onAddCompetitor={addCompetitor}
              onUpdateCompetitor={updateCompetitor}
              onRemoveCompetitor={removeCompetitor}
              onAddLink={addCompetitorLink}
              onUpdateLink={updateCompetitorLink}
              onRemoveLink={removeCompetitorLink}
              maxCompetitors={3}
              title="Competitive Landscape"
              subtitle="Add the brands your audience compares you against so we can shape smarter positioning from day one."
            />
          </div>
        );

      case 5: // Connect Accounts
        return (
          <div style={styles.stepContent}>
            <div style={styles.connectHero}>
              <div style={styles.connectHeroCopy}>
                <span style={styles.stepEyebrow}>Final Step</span>
                <h2 style={styles.connectTitle}>Connect your channels and go live</h2>
                <p style={styles.connectDesc}>
                  Link your accounts to start syncing data automatically. Facebook and Instagram can connect together, and YouTube can pair with Google My Business.
                </p>
                <div style={styles.connectChecklist}>
                  <div style={styles.connectPoint}><CheckCircle2 size={15} /> Data sync for analytics and reports</div>
                  <div style={styles.connectPoint}><CheckCircle2 size={15} /> Better post ideas and recommendations</div>
                  <div style={styles.connectPoint}><CheckCircle2 size={15} /> Faster setup once your dashboard opens</div>
                </div>
              </div>
              <div style={styles.connectHeroCard}>
                <div style={styles.connectMiniStat}>
                  <div style={styles.connectMiniValue}>{Object.values(oauthStatus || {}).filter(Boolean).length}</div>
                  <div style={styles.connectMiniLabel}>Accounts ready</div>
                </div>
                <div style={styles.connectMiniNote}>You can still finish setup now and connect more later from Settings.</div>
              </div>
            </div>

            <div style={styles.connectPanel}>
              <ConnectedAccounts
                clientId={clientId}
                status={oauthStatus}
                onRefresh={() => {}}
              />

              {getFieldError('social_connection') && (
                <div style={styles.errorTooltip}>{getFieldError('social_connection')}</div>
              )}

              <div style={styles.syncNote}>
                <CheckCircle2 size={16} style={{ color: '#16a34a', marginRight: 8 }} />
                Once connected, click "Sync Now" in your dashboard to pull your first data.
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getSubcategoriesForCategory = (category) => {
    const subcategories = {
      'Electronics': ['Consumer Electronics', 'Computer Stores', 'Mobile Phones', 'Audio Equipment', 'Video Games', 'Cameras', 'Drones', 'Smart Devices', 'Electronic Repair', 'Security Systems'],
      'Retail': ['Department Stores', 'Specialty Shops', 'Online Retail', 'Wholesale', 'Discount Stores', 'Convenience Stores', 'Pharmacies', 'Bookstores', 'Pet Stores', 'Sporting Goods'],
      'Services': ['Cleaning Services', 'Maintenance', 'Repair Services', 'Installation', 'Delivery', 'Courier', 'Security Services', 'Waste Management', 'Recycling', 'Laundry'],
      'Food & Beverage': ['Restaurants', 'Cafes', 'Fast Food', 'Bakeries', 'Catering', 'Delivery', 'Bars & Nightclubs', 'Food Trucks', 'Grocery Stores', 'Specialty Foods'],
      'Healthcare': ['Hospitals', 'Clinics', 'Dentistry', 'Pharmacy', 'Fitness', 'Mental Health', 'Chiropractic', 'Physical Therapy', 'Medical Supplies', 'Home Health Care'],
      'Education': ['Schools', 'Universities', 'Tutoring', 'Online Learning', 'Training', 'Courses', 'Daycare', 'Preschools', 'Language Schools', 'Music Schools'],
      'Real Estate': ['Residential', 'Commercial', 'Property Management', 'Real Estate Agents', 'Construction', 'Mortgage Brokers', 'Appraisal Services', 'Property Development'],
      'Automotive': ['Car Dealerships', 'Auto Repair', 'Car Rental', 'Parts', 'Motorcycles', 'Towing', 'Detailing', 'Car Wash', 'Tire Shops', 'Auto Insurance'],
      'Hospitality': ['Hotels', 'Resorts', 'Travel Agencies', 'Tourism', 'Events', 'Bed & Breakfast', 'Vacation Rentals', 'Cruise Lines', 'Airbnb Hosts'],
      'Manufacturing': ['Industrial', 'Consumer Goods', 'Textiles', 'Electronics', 'Food Processing', 'Chemicals', 'Machinery', 'Plastics', 'Metalworking', 'Packaging'],
      'Technology': ['Software', 'Hardware', 'IT Services', 'Startups', 'Consulting', 'Web Development', 'Mobile Apps', 'Cloud Services', 'Cybersecurity', 'Data Analytics'],
      'Fashion': ['Clothing', 'Accessories', 'Shoes', 'Jewelry', 'Boutiques', 'Designer Brands', 'Vintage Clothing', 'Sportswear', 'Lingerie', 'Costume Design'],
      'Sports & Recreation': ['Gyms', 'Sports Clubs', 'Outdoor Activities', 'Fitness', 'Leisure', 'Sports Equipment', 'Adventure Sports', 'Yoga Studios', 'Martial Arts', 'Dance Studios'],
      'Beauty & Wellness': ['Salons', 'Spas', 'Cosmetics', 'Wellness Centers', 'Personal Care', 'Nail Salons', 'Barber Shops', 'Tattoo Parlors', 'Massage Therapy', 'Aromatherapy'],
      'Home & Garden': ['Home Improvement', 'Gardening', 'Furniture', 'Decor', 'Tools', 'Landscaping', 'Interior Design', 'Home Staging', 'Smart Home', 'Pest Control'],
      'Professional Services': ['Accounting', 'Marketing', 'Advertising', 'Consulting', 'Legal Services', 'Architecture', 'Engineering', 'Photography', 'Graphic Design', 'Event Planning'],
      'Entertainment': ['Movie Theaters', 'Music Venues', 'Comedy Clubs', 'Art Galleries', 'Museums', 'Theaters', 'Concert Halls', 'Amusement Parks', 'Arcades', 'Escape Rooms'],
      'Transportation': ['Taxi Services', 'Ride Sharing', 'Delivery Services', 'Logistics', 'Shipping', 'Moving Services', 'Bus Services', 'Rail Services', 'Airports', 'Parking'],
      'Agriculture': ['Farms', 'Greenhouses', 'Nurseries', 'Livestock', 'Crop Production', 'Organic Farming', 'Agricultural Equipment', 'Seed Suppliers', 'Farmers Markets', 'Agricultural Consulting'],
      'Financial Services': ['Banks', 'Credit Unions', 'Investment Firms', 'Insurance', 'Mortgage Lenders', 'Financial Planning', 'Tax Services', 'Payroll Services', 'Cryptocurrency', 'Fintech'],
      'Legal Services': ['Law Firms', 'Notary Services', 'Paralegal Services', 'Legal Consulting', 'Mediation Services', 'Court Reporting', 'Intellectual Property', 'Immigration Law', 'Family Law', 'Corporate Law'],
      'Construction': ['General Contractors', 'Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Flooring', 'Painting', 'Carpentry', 'Masonry', 'Demolition'],
      'Media & Communications': ['Newspapers', 'TV Stations', 'Radio Stations', 'Podcasting', 'Social Media', 'Public Relations', 'Journalism', 'Film Production', 'Advertising Agencies', 'Publishing'],
      'Non-Profit': ['Charities', 'Foundations', 'NGOs', 'Community Organizations', 'Religious Organizations', 'Environmental Groups', 'Animal Welfare', 'Youth Organizations', 'Arts & Culture', 'Education Advocacy'],
      'Government': ['Municipal Services', 'State Agencies', 'Federal Agencies', 'Public Safety', 'Utilities', 'Transportation', 'Parks & Recreation', 'Libraries', 'Courts', 'Licensing']
    };
    return subcategories[category] || [];
  };

  return (
    <div style={styles.page}>
      <PageHeader
        title="Complete Your Profile"
        subtitle="Set up your business profile to get the most out of Statox"
      />

      <div style={styles.heroShell}>
        <div style={styles.heroCopy}>
          <span style={styles.heroBadge}>Onboarding Flow</span>
          <h2 style={styles.heroTitle}>Build a dashboard that already feels tailored to your business</h2>
          <p style={styles.heroText}>
            Move through the essentials once, and we’ll use them to personalize reports, social planning, ROI, and AI-powered content.
          </p>
        </div>
        <div style={styles.heroMeter}>
          <div style={styles.heroMeterTop}>
            <span style={styles.heroMeterLabel}>Setup progress</span>
            <span style={styles.heroMeterValue}>{progressPct}%</span>
          </div>
          <div style={styles.heroProgressTrack}>
            <div style={{ ...styles.heroProgressFill, width: `${progressPct}%` }} />
          </div>
          <div style={styles.heroMeterFoot}>
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={styles.progressContainer}>
        {steps.map((step, index) => (
          <div key={step.id} style={styles.stepItem}>
            <div style={{
              ...styles.stepCircle,
              background: index <= currentStep ? CYAN : '#e5e7eb',
              color: index <= currentStep ? '#021418' : '#6b7280'
            }}>
              {index < currentStep ? <CheckCircle2 size={16} /> : <step.icon size={16} />}
            </div>
            <div style={styles.stepText}>
              <div style={styles.stepMicro}>{step.eyebrow}</div>
              <div style={styles.stepTitle}>{step.title}</div>
              <div style={styles.stepDesc}>{step.description}</div>
            </div>
            {index < steps.length - 1 && <div style={styles.stepLine} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div style={styles.contentCard}>
        <div style={styles.contentHeader}>
          <div style={styles.contentHeaderLeft}>
            <div style={styles.contentIconWrap}>
              <currentStepData.icon size={18} />
            </div>
            <div>
              <div style={styles.contentEyebrow}>{currentStepData.eyebrow}</div>
              <div style={styles.contentTitle}>{currentStepData.title}</div>
            </div>
          </div>
          <div style={styles.contentStepBadge}>{currentStep + 1} / {steps.length}</div>
        </div>
        {submitError && <div style={styles.submitBanner}>{submitError}</div>}
        {renderStepContent()}

        {/* Navigation */}
        <div style={styles.navigation}>
          <button
            onClick={handleSkip}
            style={styles.skipBtn}
            disabled={loading}
          >
            Skip for now
          </button>

          <div style={styles.navRight}>
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                style={styles.backBtn}
                disabled={loading}
              >
                Back
              </button>
            )}

            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                style={styles.nextBtn}
                disabled={loading}
              >
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                style={styles.submitBtn}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: '28px 32px 40px',
    maxWidth: 1240,
    margin: '0 auto',
    width: '100%'
  },
  heroShell: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, .9fr)',
    gap: 18,
    marginBottom: 22,
    padding: '22px 24px',
    borderRadius: 26,
    background: 'linear-gradient(135deg, #ecfeff 0%, #ffffff 48%, #eef2ff 100%)',
    border: '1px solid #c7f3ff',
    boxShadow: '0 18px 44px rgba(15,23,42,.05)',
  },
  heroCopy: { minWidth: 0 },
  heroBadge: {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: 999,
    background: '#ffffff',
    color: '#0f766e',
    fontSize: 12,
    fontWeight: 800,
    boxShadow: '0 1px 2px rgba(15,23,42,.05)',
  },
  heroTitle: {
    margin: '14px 0 8px',
    fontSize: 30,
    lineHeight: 1.12,
    fontWeight: 900,
    color: '#0f172a',
    maxWidth: 700,
  },
  heroText: {
    margin: 0,
    color: '#64748b',
    fontSize: 14,
    lineHeight: 1.7,
    maxWidth: 720,
  },
  heroMeter: {
    padding: 18,
    borderRadius: 22,
    background: 'rgba(255,255,255,.82)',
    border: '1px solid #dbeafe',
    alignSelf: 'stretch',
    display: 'grid',
    gap: 12,
  },
  heroMeterTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMeterLabel: { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' },
  heroMeterValue: { fontSize: 26, fontWeight: 900, color: '#0f172a' },
  heroProgressTrack: { height: 12, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' },
  heroProgressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #00d7ff 0%, #38bdf8 45%, #34d399 100%)' },
  heroMeterFoot: { fontSize: 13, color: '#475569', fontWeight: 600 },
  contentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'center',
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  contentHeaderLeft: {
    display: 'flex',
    gap: 14,
    alignItems: 'center',
  },
  contentIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    background: 'linear-gradient(135deg, #00d7ff 0%, #0ea5e9 100%)',
    color: '#042f3a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(14,165,233,.22)',
  },
  contentEyebrow: { fontSize: 11, fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '.1em' },
  contentTitle: { marginTop: 4, fontSize: 22, fontWeight: 800, color: '#0f172a' },
  contentStepBadge: {
    padding: '8px 12px',
    borderRadius: 999,
    background: '#f1f5f9',
    color: '#334155',
    fontSize: 12,
    fontWeight: 800,
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    position: 'relative',
    gap: 12,
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
    minWidth: 0,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
    zIndex: 1,
    boxShadow: '0 6px 18px rgba(15,23,42,.08)',
  },
  stepText: { marginLeft: 12, flex: 1 },
  stepMicro: { fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 },
  stepTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  stepDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  stepLine: {
    position: 'absolute',
    top: 19,
    left: 40,
    right: -20,
    height: 2,
    background: '#e5e7eb',
    zIndex: 0,
  },
  contentCard: {
    background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
    borderRadius: 28,
    padding: 40,
    boxShadow: '0 20px 48px rgba(15,23,42,.06)',
    border: '1px solid #e2e8f0',
  },
  stepContent: { marginBottom: 40 },
  stepIntro: {
    marginBottom: 18,
  },
  stepEyebrow: {
    display: 'inline-block',
    padding: '5px 10px',
    borderRadius: 999,
    background: '#f0f9ff',
    color: '#0284c7',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  stepHeading: {
    margin: '14px 0 8px',
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1.12,
    color: '#0f172a',
    maxWidth: 760,
  },
  stepSummary: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.7,
    color: '#64748b',
    maxWidth: 760,
  },
  featureRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14,
    marginBottom: 18,
  },
  featureCard: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: '16px 18px',
    borderRadius: 18,
    background: 'linear-gradient(135deg, #f8fafc 0%, #eefafe 100%)',
    border: '1px solid #dbeafe',
    color: '#0f172a',
  },
  featureTitle: { fontSize: 14, fontWeight: 800, marginBottom: 4 },
  featureText: { fontSize: 12, color: '#64748b', lineHeight: 1.55 },
  panelGrid: {
    display: 'grid',
    gap: 18,
  },
  formPanel: {
    display: 'grid',
    gap: 20,
    padding: 22,
    borderRadius: 22,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 26px rgba(15,23,42,.04)',
  },
  formPanelAlt: {
    display: 'grid',
    gap: 20,
    padding: 22,
    borderRadius: 22,
    background: 'linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%)',
    border: '1px solid #e2e8f0',
  },
  panelTitle: { fontSize: 16, fontWeight: 800, color: '#0f172a' },
  field: { marginBottom: 24 },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: '#ef4444',
    marginLeft: 2,
    fontWeight: 800,
  },
  input: {
    width: '100%',
    height: 48,
    padding: '0 16px',
    borderRadius: 16,
    border: '1.5px solid #dbe4ee',
    fontSize: 15,
    background: '#fff',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 16,
    border: '1.5px solid #dbe4ee',
    fontSize: 15,
    background: '#fff',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    minHeight: 100,
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    height: 48,
    padding: '0 16px',
    borderRadius: 16,
    border: '1.5px solid #dbe4ee',
    fontSize: 15,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 20,
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  checkboxPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    background: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    color: '#334155',
    fontWeight: 600,
  },
  checkboxPillActive: {
    border: '1px solid #7dd3fc',
    background: '#ecfeff',
    color: '#0f172a',
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: CYAN,
  },
  choiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },
  choiceCard: {
    padding: '12px 14px',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#334155',
    fontWeight: 700,
  },
  choiceCardActive: {
    border: '1px solid #67e8f9',
    background: 'linear-gradient(135deg, #ecfeff 0%, #f0fdf4 100%)',
    color: '#0f172a',
    boxShadow: '0 10px 24px rgba(34,211,238,.12)',
  },
  choiceTitle: { fontSize: 14, fontWeight: 800 },
  fileUpload: { display: 'flex', flexDirection: 'column', gap: 12 },
  fileInput: { display: 'none' },
  fileLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 16px',
    borderRadius: 16,
    border: '2px dashed #bae6fd',
    background: 'linear-gradient(180deg, #f8fdff 0%, #effbff 100%)',
    color: '#0369a1',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    transition: 'all 0.2s',
  },
  assetCard: {
    display: 'grid',
    gap: 14,
    padding: 22,
    borderRadius: 22,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
  },
  assetCardAlt: {
    display: 'grid',
    gap: 14,
    padding: 22,
    borderRadius: 22,
    background: 'linear-gradient(180deg, #f8fafc 0%, #fbfdff 100%)',
    border: '1px solid #e2e8f0',
  },
  assetCardTitle: { fontSize: 18, fontWeight: 800, color: '#0f172a' },
  assetCardText: { fontSize: 13, color: '#64748b', lineHeight: 1.6 },
  singlePreviewCard: {
    padding: 14,
    borderRadius: 18,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    alignSelf: 'flex-start',
  },
  filePreview: {
    position: 'relative',
    display: 'inline-block',
  },
  previewImgLarge: {
    width: 120,
    height: 120,
    objectFit: 'cover',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 12,
  },
  errorTooltip: {
    marginTop: 8,
    display: 'inline-flex',
    padding: '8px 10px',
    borderRadius: 12,
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    color: '#be123c',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.4,
    maxWidth: '100%',
  },
  submitBanner: {
    marginBottom: 18,
    padding: '12px 14px',
    borderRadius: 14,
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#c2410c',
    fontSize: 13,
    fontWeight: 700,
  },
  connectHero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(240px, .8fr)',
    gap: 18,
    marginBottom: 18,
    padding: 22,
    borderRadius: 24,
    background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #ecfeff 100%)',
    border: '1px solid #dbeafe',
  },
  connectHeroCopy: { minWidth: 0 },
  connectHeroCard: {
    padding: 20,
    borderRadius: 22,
    background: '#fff',
    border: '1px solid #e2e8f0',
    display: 'grid',
    alignContent: 'space-between',
    gap: 12,
  },
  connectMiniStat: { display: 'grid', gap: 4 },
  connectMiniValue: { fontSize: 34, fontWeight: 900, color: '#0f172a' },
  connectMiniLabel: { fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' },
  connectMiniNote: { fontSize: 13, lineHeight: 1.6, color: '#64748b' },
  connectTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: '#0f172a',
    margin: '14px 0 10px',
  },
  connectDesc: {
    color: '#64748b',
    marginBottom: 18,
    lineHeight: 1.6,
  },
  connectChecklist: { display: 'grid', gap: 10 },
  connectPoint: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#334155',
    fontWeight: 600,
  },
  connectPanel: {
    padding: 22,
    borderRadius: 24,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
  },
  syncNote: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#dcfce7',
    borderRadius: 12,
    color: '#166534',
    fontSize: 14,
    marginTop: 20,
  },
  navigation: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 32,
    borderTop: '1px solid #e2e8f0',
    gap: 12,
    flexWrap: 'wrap',
  },
  navRight: { display: 'flex', gap: 12 },
  skipBtn: {
    padding: '12px 20px',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  },
  backBtn: {
    padding: '12px 20px',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  },
  nextBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #00d7ff 0%, #38bdf8 100%)',
    color: '#042f3a',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    boxShadow: '0 12px 24px rgba(0,215,255,.22)',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    boxShadow: '0 12px 24px rgba(34,197,94,.22)',
  },
};
