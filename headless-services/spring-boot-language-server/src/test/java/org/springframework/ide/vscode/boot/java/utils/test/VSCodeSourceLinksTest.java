/*******************************************************************************
 * Copyright (c) 2018 Pivotal, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Pivotal, Inc. - initial API and implementation
 *******************************************************************************/
package org.springframework.ide.vscode.boot.java.utils.test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.net.URI;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

import org.junit.Test;
import org.springframework.ide.vscode.boot.java.links.VSCodeSourceLinks;
import org.springframework.ide.vscode.commons.maven.MavenBuilder;
import org.springframework.ide.vscode.commons.maven.MavenCore;
import org.springframework.ide.vscode.commons.maven.java.MavenJavaProject;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;

/**
 * Tests for creation of VSCode links in hover documentation
 *
 * @author Alex Boyko
 *
 */
public class VSCodeSourceLinksTest {

	private static LoadingCache<String, MavenJavaProject> mavenProjectsCache = CacheBuilder.newBuilder().build(new CacheLoader<String, MavenJavaProject>() {

		@Override
		public MavenJavaProject load(String projectName) throws Exception {
			Path testProjectPath = Paths.get(VSCodeSourceLinksTest.class.getResource("/test-projects/" + projectName).toURI());
			MavenBuilder.newBuilder(testProjectPath).clean().pack().javadoc().skipTests().execute();
			return new MavenJavaProject(MavenCore.getDefault(), testProjectPath.resolve(MavenCore.POM_XML).toFile());
		}

	});

	@Test
	public void testJavaSourceUrl() throws Exception {
		MavenJavaProject project = mavenProjectsCache.get("empty-boot-15-web-app");
		Optional<String> url = new VSCodeSourceLinks(null).sourceLinkUrlForFQName(project, "com.example.EmptyBoot15WebAppApplication");
		assertTrue(url.isPresent());
		Path projectPath = Paths.get(project.pom().getParent());
		URI uri = URI.create(url.get());
		
		// Use File to get rid of the fragment parts of the URL. The URL may have fragments that indicate line and column numbers
		uri = new File(uri.getPath()).toURI();

		Path relativePath = projectPath.relativize(Paths.get(uri));
		assertEquals(Paths.get("src/main/java/com/example/EmptyBoot15WebAppApplication.java"), relativePath);
		String positionPart = url.get().substring(url.get().lastIndexOf('#'));
		assertEquals("#7,14", positionPart);
	}

	@Test
	public void testJarUrl() throws Exception {
		MavenJavaProject project = mavenProjectsCache.get("empty-boot-15-web-app");
		Optional<String> url = new VSCodeSourceLinks(null).sourceLinkUrlForFQName(project, "org.springframework.boot.autoconfigure.SpringBootApplication");
		assertTrue(url.isPresent());
		String headerPart = url.get().substring(0, url.get().indexOf('?'));
		assertEquals("jdt://contents/spring-boot-autoconfigure-1.5.8.RELEASE.jar/org.springframework.boot.autoconfigure/SpringBootApplication.class", headerPart);
		String positionPart = url.get().substring(url.get().lastIndexOf('#'));
		assertEquals("#55,19", positionPart);
	}

	@Test
	public void testJarUrlInnerType() throws Exception {
		MavenJavaProject project = mavenProjectsCache.get("empty-boot-15-web-app");
		Optional<String> url = new VSCodeSourceLinks(null).sourceLinkUrlForFQName(project, "org.springframework.web.client.RestTemplate$AcceptHeaderRequestCallback");
		assertTrue(url.isPresent());
		String headerPart = url.get().substring(0, url.get().indexOf('?'));
		assertEquals("jdt://contents/spring-web-4.3.12.RELEASE.jar/org.springframework.web.client/RestTemplate$AcceptHeaderRequestCallback.class", headerPart);
		String positionPart = url.get().substring(url.get().lastIndexOf('#'));
		assertEquals("#747,16", positionPart);
	}

}
