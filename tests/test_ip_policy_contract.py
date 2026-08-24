from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = (ROOT / 'web' / 'ip-policy-core.js').read_text(encoding='utf-8')
INDEX = (ROOT / 'web' / 'index.html').read_text(encoding='utf-8')


def test_only_canonical_ip_integration_is_loaded():
    assert 'ip-policy-core.js' in INDEX
    assert 'product-integration-v30.js' not in INDEX
    assert 'product-integration-v31.js' not in INDEX
    assert 'product-integration-v33.js' not in INDEX


def test_goal_is_binary_and_ambiguous_purpose_requires_clarification():
    assert "customer_acquisition" in POLICY
    assert "recruitment" in POLICY
    assert "if (recruit && !customer)" in POLICY
    assert "if (customer && !recruit)" in POLICY
    assert "return '';" in POLICY
    assert '吸引潜在客户' in POLICY
    assert '吸引潜在增员对象' in POLICY


def test_lifestyle_topics_are_secondary_only():
    for topic in ['养生','美食','读书','旅行','智能家居','运动','骑行']:
        assert topic in POLICY
    assert "return ['增员与职业发展']" in POLICY
    assert "['家庭保障', '养老规划', '保险知识']" in POLICY


def test_headline_does_not_use_person_name_anchor():
    headline_block = POLICY.split('function headline(profile)', 1)[1].split('const XHS_BANNED', 1)[0]
    for forbidden in ['preferredName', 'topNicknames', 'profile?.name']:
        assert forbidden not in headline_block


def test_license_and_disclaimer_have_one_owner():
    assert '合规尾部是唯一允许输出机构/执业编号/声明的位置' in POLICY
    assert POLICY.count('执业编号：${license}') == 1
    assert 'complianceFooter(profile, platform)' in POLICY


def test_bio_uses_real_profile_assets_not_hobby_tag_wall():
    for source in ['previousCareer','selfIntro','insuranceYears','honors','peerReviewSummary','services']:
        assert source in POLICY
    # 兴趣只允许进入 secondaryTopics，不允许进入 bioBody。
    bio_block = POLICY.split('function bioBody(profile, platform, variant)', 1)[1].split('function complianceFooter', 1)[0]
    assert 'hobbies' not in bio_block
